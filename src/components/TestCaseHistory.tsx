import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TestCase } from "../types/TestCase";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

interface TestCaseHistoryProps {
  testCases: TestCase[];
  testSuiteId: string;
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

const TestCaseHistory: React.FC<TestCaseHistoryProps> = ({
  testCases,
  testSuiteId,
}) => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);

  useEffect(() => {
    loadTestResults();
  }, [testSuiteId]);

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
    let testCasesXml = '';

    result.test_results.forEach(testResult => {
      const testCase = testCases.find(tc => tc.id === testResult.test_case_id);
      const testName = testCase?.name || "Unknown Test Case";
      
      // 各ステップの結果を集計
      const hasFailure = testResult.results.some(r => r.status === "NG");
      if (hasFailure) failures++;
      totalTests++;

      // テストケースの詳細をXMLに変換
      const failureDetails = testResult.results
        .filter(r => r.status === "NG")
        .map(r => `Step: ${r.step}\nExpected: ${r.expected}\nComment: ${r.comment}`)
        .join("\n");

      testCasesXml += `    <testcase name="${testName}" classname="${result.test_suite_id}"${
        hasFailure 
          ? `>\n      <failure message="Test failed" type="AssertionError">${failureDetails}</failure>\n    </testcase>`
          : ' />'
      }\n`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="${result.test_suite_id}" timestamp="${timestamp}" tests="${totalTests}" failures="${failures}">
${testCasesXml}  </testsuite>
</testsuites>`;
  };

  const handleExportJUnit = async () => {
    if (!selectedResult) return;

    try {
      const filePath = await save({
        filters: [{
          name: 'XML',
          extensions: ['xml']
        }],
        defaultPath: `${selectedResult.test_run_name}.xml`
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
                  {result.test_run_name} - {result.executed_by} ({formatDate(result.executed_at)})
                </option>
              ))}
            </select>
            {selectedResult && (
              <div className="flex space-x-2">
                <button
                  onClick={handleExportJUnit}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  JUnitエクスポート
                </button>
                <button
                  onClick={() => handleDeleteResult(selectedResult.test_run_name)}
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
              <h3 className="text-lg font-semibold mb-4">
                テスト結果詳細: {selectedResult.test_run_name}
              </h3>
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2">テストケース</th>
                    <th className="border border-gray-300 px-4 py-2">手順</th>
                    <th className="border border-gray-300 px-4 py-2">期待値</th>
                    <th className="border border-gray-300 px-4 py-2">結果</th>
                    <th className="border border-gray-300 px-4 py-2">コメント</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedResult.test_results.map((testResult) => {
                    const testCase = testCases.find(
                      (tc) => tc.id === testResult.test_case_id
                    );
                    return testResult.results.map((result, stepIndex) => (
                      <tr key={`${testResult.test_case_id}-${stepIndex}`}>
                        {stepIndex === 0 && (
                          <td
                            className="border border-gray-300 px-4 py-2"
                            rowSpan={testResult.results.length}
                          >
                            <div>
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{testCase?.name || "不明なテストケース"}</ReactMarkdown>                              
                            </div>
                          </td>
                        )}
                        <td className="border border-gray-300 px-4 py-2">
                          <div className="prose">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.step}</ReactMarkdown>
                          </div>
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          <div className="prose">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.expected}</ReactMarkdown>
                          </div>
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          <span
                            className={`px-2 py-1 rounded text-white ${
                              result.status === "OK"
                                ? "bg-green-500"
                                : result.status === "NG"
                                ? "bg-red-500"
                                : "bg-yellow-500"
                            }`}
                          >
                            {result.status}
                          </span>
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          <div className="prose">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.comment}</ReactMarkdown>
                          </div>
                        </td>
                      </tr>
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
