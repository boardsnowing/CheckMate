import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TestCase } from "../types/TestCase";
import Step from "./common/Step";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { PDFExporter } from "./PDFExporter";

interface TestCaseHistoryProps {
  testCases: TestCase[];
  testSuiteId: string;
}

interface TestSuiteData {
  id: string;
  name: string;
  precondition?: string;
  test_cases: TestCase[];
}

interface TestResult {
  test_suite_id: string;
  test_run_name: string;
  executed_by: string;
  executed_at: string;
  test_results: Array<{
    test_case_id: string;
    results: Array<{
      step: string;
      expected: string;
      status: string;
      comment: string;
    }>;
  }>;
}


function TestCaseHistory({
  testCases,
  testSuiteId,
}: TestCaseHistoryProps) {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);
  const [testSuiteName, setTestSuiteName] = useState<string>("");
  const [testSuitePrecondition, setTestSuitePrecondition] = useState<string>("");
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);

  useEffect(() => {
    loadTestResults();
    loadTestSuiteName();
  }, [testSuiteId]);

  const loadTestSuiteName = async () => {
    try {
      const testSuite = await invoke<TestSuiteData>("get_test_suite", {
        id: testSuiteId,
      });
      setTestSuiteName(testSuite.name);
      if(testSuite.precondition) {
        console.log(testSuite.precondition)
          const unescapedPrecondition = testSuite.precondition
            .replace(/\\n/g, "\n")
            .replace(/\\t/g, "\t");
          setTestSuitePrecondition(unescapedPrecondition)
        console.log(testSuitePrecondition)
      }
      else {
        setTestSuitePrecondition("")
      }

    } catch (error) {
      console.error("テストスイート名の取得に失敗しました:", error);
    }
  };

  const loadTestResults = async () => {
    try {
      const results = await invoke<TestResult[]>("get_test_results", {
        testSuiteId,
      });
      setTestResults(results);
    } catch (error) {
      console.error("テスト結果の読み込みに失敗しました:", error);
    }
  };

  const generateJUnitXML = (result: TestResult): string => {
    const timestamp = new Date(result.executed_at).toISOString();
    let totalTests = 0;
    let failures = 0;
    let testCasesXml = "";

    result.test_results.forEach((testResult) => {
      const testCase = testCases.find(
        (tc) => tc.id === testResult.test_case_id
      );
      const testName = testCase?.name || "Unknown Test Case";

      // 各ステップの結果を集計
      const hasFailure = testResult.results.some((r) => r.status === "NG");
      if (hasFailure) failures++;
      totalTests++;

      // テストケースの詳細をXMLに変換
      const failureDetails = testResult.results
        .filter((r) => r.status === "NG")
        .map(
          (r) =>
            `Step: ${r.step}\nExpected: ${r.expected}\nComment: ${r.comment}`
        )
        .join("\n");

      testCasesXml += `    <testcase name="${testName}" classname="${
        result.test_suite_id
      }"${
        hasFailure
          ? `>\n      <failure message="Test failed" type="AssertionError">${failureDetails}</failure>\n    </testcase>`
          : " />"
      }\n`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="${result.test_suite_id}" timestamp="${timestamp}" tests="${totalTests}" failures="${failures}">
${testCasesXml}  </testsuite>
</testsuites>`;
  };


  const handleExportPDF = async () => {
    if (!selectedResult) return;

    try {
      const filePath = await save({
        filters: [
          {
            name: "PDF",
            extensions: ["pdf"],
          },
        ],
        defaultPath: `${selectedResult.test_run_name.replace(".json", "")}.pdf`,
      });

      if (filePath) {
        const pdfExporter = new PDFExporter(
          testSuiteName,
          testSuitePrecondition,
          testCases
        );
        const blob = await pdfExporter.exportToPDF(selectedResult);
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        await writeFile(filePath, uint8Array);
      }
    } catch (error) {
      console.error("PDFエクスポートに失敗しました:", error);
      alert("PDFエクスポートに失敗しました");
    }
  };

  const handleExportJUnit = async () => {
    if (!selectedResult) return;

    try {
      const filePath = await save({
        filters: [
          {
            name: "XML",
            extensions: ["xml"],
          },
        ],
        defaultPath: `${selectedResult.test_run_name.replace(".json", "")}.xml`,
      });

      if (filePath) {
        const junitXml = generateJUnitXML(selectedResult);
        const encoder = new TextEncoder();
        await writeFile(filePath, encoder.encode(junitXml));
      }
    } catch (error) {
      console.error("JUnitエクスポートに失敗しました:", error);
      alert("JUnitエクスポートに失敗しました");
    }
  };

  const handleExportCSV = async () => {
    if (!selectedResult) return;

    try {
      const filePath = await save({
        filters: [
          {
            name: "CSV",
            extensions: ["csv"],
          },
        ],
        defaultPath: `${selectedResult.test_run_name.replace(".json", "")}.csv`,
      });

      if (filePath) {
        const csvContent = generateCSV(selectedResult);
        const encoder = new TextEncoder();
        // BOMを追加してExcelで正しく文字化けしないようにする
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const csvBytes = encoder.encode(csvContent);
        const csvWithBom = new Uint8Array(bom.length + csvBytes.length);
        csvWithBom.set(bom);
        csvWithBom.set(csvBytes, bom.length);
        await writeFile(filePath, csvWithBom);
      }
    } catch (error) {
      console.error("CSVエクスポートに失敗しました:", error);
      alert("CSVエクスポートに失敗しました");
    }
  };

  const generateCSV = (result: TestResult): string => {
    // Markdownの改行を適切に処理する関数
    const processMarkdownForCSV = (text: string): string => {
      if (!text) return "";
      
      // Markdownの改行（\n）をCSV内の改行として保持
      // ダブルクォートをエスケープ
      return text.replace(/"/g, '""');
    };

    // CSVの行を格納する配列
    const rows: string[] = [];
    
    // 1. 試験名称
    rows.push(`"試験名称","${processMarkdownForCSV(testSuiteName)}"`);
    rows.push(""); // 空行
    
    // 2. テスト結果集計
    const counts = calculateStatusCounts(result);
    rows.push('"テスト結果集計"');
    rows.push(`"OK","${counts.OK}"`);
    rows.push(`"NG","${counts.NG}"`);
    rows.push(`"N/A","${counts.NA}"`);
    rows.push(`"未実施","${counts.Unmarked}"`);
    rows.push(""); // 空行
    
    // 3. 前提条件
    if (testSuitePrecondition) {
      rows.push('"前提条件"');
      rows.push(`"${processMarkdownForCSV(testSuitePrecondition)}"`);
      rows.push(""); // 空行
    }
    
    // 4. 試験のヘッダ
    const headers = ["テストケース", "No", "手順", "期待値", "結果", "コメント"];
    rows.push(headers.map(header => `"${header}"`).join(","));
    
    // 5. 試験の内容
    result.test_results.forEach((testResult, testIndex) => {
      const testCase = testCases.find(tc => tc.id === testResult.test_case_id);
      const testCaseName = testCase?.name || "不明なテストケース";

      testResult.results.forEach((stepResult, stepIndex) => {
        const row = [
          // テストケース（各テストケースの最初の行のみ）
          stepIndex === 0 ? `"${processMarkdownForCSV(testCaseName)}"` : '""',
          // No
          `\'"${testIndex + 1}-${stepIndex + 1}"`,
          // 手順
          `"${processMarkdownForCSV(stepResult.step)}"`,
          // 期待値
          `"${processMarkdownForCSV(stepResult.expected)}"`,
          // 結果
          `"${stepResult.status}"`,
          // コメント
          `"${processMarkdownForCSV(stepResult.comment)}"`
        ];
        
        rows.push(row.join(","));
      });
    });

    return rows.join("\n");
  };

  const handleDeleteResult = async (fileName: string) => {
    if (!window.confirm("このテスト結果を削除してもよろしいですか？")) {
      return;
    }

    try {
      await invoke("delete_test_result", {
        testSuiteId,
        fileName,
      });
      await loadTestResults();
      if (selectedResult?.test_run_name === fileName) {
        setSelectedResult(null);
      }
    } catch (error) {
      console.error("テスト結果の削除に失敗しました:", error);
      alert("テスト結果の削除に失敗しました");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ja-JP");
  };

  const calculateStatusCounts = (result: TestResult) => {
    const counts = {
      OK: 0,
      NG: 0,
      NA: 0,
      Unmarked: 0,
    };

    // テストケース全体の結果を集計
    result.test_results.forEach((testResult) => {
      // テストケースの結果を判定
      let hasUnmarked = false;
      let hasNG = false;
      let validSteps = 0;

      testResult.results.forEach(step => {
        if (step.status === "N/A") return; // N/Aは判定から除外
        
        if (!step.status || step.status === "") {
          hasUnmarked = true;
        } else if (step.status === "NG") {
          hasNG = true;
        } else if (step.status === "OK") {
          validSteps++;
        }
      });

      // テストケース全体の判定
      if (hasUnmarked) counts.Unmarked++;
      else if (hasNG) counts.NG++;
      else if (validSteps > 0) counts.OK++;
      else counts.NA++;
    });

    return counts;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-4">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-lg font-semibold mb-4">テスト実行履歴</h3>
          <div className="flex items-center space-x-4">
            <select
              className="flex-grow p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedResult?.test_run_name || ""}
              onChange={(e) => {
                const selected = testResults.find(
                  (result) => result.test_run_name === e.target.value
                );
                setSelectedResult(selected || null);
              }}
            >
              <option value="">テスト結果を選択してください</option>
              {testResults.map((result) => (
                <option key={result.test_run_name} value={result.test_run_name}>
                  {result.test_run_name} - {result.executed_by} (
                  {formatDate(result.executed_at)})
                </option>
              ))}
            </select>
            {selectedResult && (
              <div className="flex space-x-2">
                <button
                  onClick={handleExportPDF}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  PDFエクスポート
                </button>
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  CSVエクスポート
                </button>
                <button
                  onClick={handleExportJUnit}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  JUnitエクスポート
                </button>
                <button
                  onClick={() =>
                    handleDeleteResult(selectedResult.test_run_name)
                  }
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  削除
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded shadow">
          {selectedResult ? (
            <div>
              <div className="mb-4 border rounded bg-gray-50">
                <div className="flex justify-between items-center p-2 bg-gray-100 border-b">
                  <button
                    onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                    className="flex items-center space-x-2"
                  >
                    <span className="transform transition-transform duration-200">
                      {isSummaryExpanded ? "▼" : "▶"}
                    </span>
                    <span className="font-medium">テストケース単位の集計</span>
                  </button>
                </div>
                {isSummaryExpanded && (
                  <div className="p-4">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-4 py-2">No.</th>
                          <th className="border border-gray-300 px-4 py-2">テストケース</th>
                          <th className="border border-gray-300 px-4 py-2">OK</th>
                          <th className="border border-gray-300 px-4 py-2">NG</th>
                          <th className="border border-gray-300 px-4 py-2">N/A</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedResult.test_results.map((testResult, index) => {
                          const testCase = testCases.find(
                            (tc) => tc.id === testResult.test_case_id
                          );
                          const statusCounts = {
                            OK: 0,
                            NG: 0,
                            NA: 0
                          };
                          
                          testResult.results.forEach(step => {
                            if (step.status === "OK") statusCounts.OK++;
                            else if (step.status === "NG") statusCounts.NG++;
                            else if (step.status === "N/A") statusCounts.NA++;
                          });

                          return (
                            <tr key={testResult.test_case_id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              <td className="border border-gray-300 px-4 py-2 text-center">{index + 1}</td>
                              <td className="border border-gray-300 px-4 py-2">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {testCase?.name || "不明なテストケース"}
                                </ReactMarkdown>
                              </td>
                              <td className="border border-gray-300 px-4 py-2 text-center">
                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                                  {statusCounts.OK}
                                </span>
                              </td>
                              <td className="border border-gray-300 px-4 py-2 text-center">
                                <span className="px-2 py-1 bg-red-100 text-red-800 rounded">
                                  {statusCounts.NG}
                                </span>
                              </td>
                              <td className="border border-gray-300 px-4 py-2 text-center">
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                                  {statusCounts.NA}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold">
                  テスト結果詳細: {selectedResult.test_run_name}
                </h3>
                {(() => {
                  const counts = calculateStatusCounts(selectedResult);
                  return (
                    <div className="mt-2 flex space-x-4">
                      <div className="px-3 py-1 bg-green-100 text-green-800 rounded">
                        OK: {counts.OK}
                      </div>
                      <div className="px-3 py-1 bg-red-100 text-red-800 rounded">
                        NG: {counts.NG}
                      </div>
                      <div className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded">
                        N/A: {counts.NA}
                      </div>
                      <div className="px-3 py-1 bg-gray-100 text-gray-800 rounded">
                        未実施: {counts.Unmarked}
                      </div>
                    </div>
                  );
                })()}
              </div>
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 w-1/4">
                      テストケース
                    </th>
                    <th className="border border-gray-300 px-4 py-2 w-16">
                      No
                    </th>
                    <th className="border border-gray-300 px-4 py-2 w-1/5">
                      手順
                    </th>
                    <th className="border border-gray-300 px-4 py-2 w-1/4">
                      期待値
                    </th>
                    <th className="border border-gray-300 px-4 py-2 w-20">
                      結果
                    </th>
                    <th className="border border-gray-300 px-4 py-2 w-1/5">
                      コメント
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedResult.test_results.map((testResult) => {
                    const testCase = testCases.find(
                      (tc) => tc.id === testResult.test_case_id
                    );
                    return testResult.results.map((result, stepIndex) => (
                      <Step
                        key={`${testResult.test_case_id}-${stepIndex}`}
                        step={{
                          step: result.step,
                          expected: result.expected,
                        }}
                        caseIndex={selectedResult.test_results.indexOf(testResult)}
                        stepIndex={stepIndex}
                        mode="history"
                        alternatingColor={
                          selectedResult.test_results.indexOf(testResult) % 2 === 0
                            ? "blue"
                            : "green"
                        }
                        historyResult={result.status}
                        historyComment={result.comment}
                        showTestCaseName={stepIndex === 0}
                        testCaseName={testCase?.name || "不明なテストケース"}
                        totalStepsInCase={testResult.results.length}
                      />
                    ));
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              テスト結果を選択してください
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestCaseHistory;
