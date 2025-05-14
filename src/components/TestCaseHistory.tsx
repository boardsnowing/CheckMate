import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TestCase } from "../types/TestCase";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
  Font,
} from "@react-pdf/renderer";
import { marked } from "marked";

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

Font.register({
  family: "SourceHanSansHW",
  fonts: [
    {
      src: "../fonts/SourceHanSansHW-Regular.otf",
    },
    {
      src: "../fonts/SourceHanSansHW-Bold.otf",
      fontWeight: "bold",
    },
  ],
});

const TestCaseHistory: React.FC<TestCaseHistoryProps> = ({
  testCases,
  testSuiteId,
}) => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);
  const [testSuiteName, setTestSuiteName] = useState<string>("");
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

  // PDFスタイルの定義
  const styles = StyleSheet.create({
    page: {
      flexDirection: "column",
      backgroundColor: "#ffffff",
      padding: 30,
      fontFamily: "SourceHanSansHW",
    },
    coverTitle: {
      marginTop: 200,
      alignItems: "center",
    },
    coverTitleText: {
      fontSize: 24,
      marginBottom: 10,
      textAlign: "center",
    },
    coverSubTitleText: {
      fontSize: 18,
      textAlign: "center",
    },
    stampSection: {
      position: "absolute",
      bottom: 50,
      right: 50,
    },
    stampTable: {
      width: 180,
      borderStyle: "solid",
      borderWidth: 1,
      borderColor: "#000",
    },
    stampRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: "#000",
    },
    stampHeader: {
      width: 60,
      padding: 5,
      borderRightWidth: 1,
      borderRightColor: "#000",
      textAlign: "center",
      fontSize: 10,
    },
    stampCell: {
      width: 60,
      height: 60,
      borderRightWidth: 1,
      borderRightColor: "#000",
    },
    header: {
      fontSize: 18,
      marginBottom: 20,
    },
    summary: {
      flexDirection: "row",
      marginBottom: 20,
    },
    summaryItem: {
      padding: 5,
      borderRadius: 4,
      marginRight: 10,
    },
    table: {
      width: "100%",
      borderStyle: "solid",
      borderWidth: 1,
      borderColor: "#000",
      marginBottom: 10,
    },
    tableRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: "#000",
    },
    tableHeader: {
      backgroundColor: "#f0f0f0",
    },
    tableCell: {
      padding: 5,
      borderRightWidth: 1,
      borderRightColor: "#000",
      fontSize: 10,
    },
    testCase: { width: "25%" },
    step: { width: "20%" },
    expected: { width: "25%" },
    result: { width: "10%" },
    comment: { width: "20%" },
  });

  // PDFドキュメントの定義
  // MarkdownをHTMLに変換し、スタイル付きのテキストに変換する関数
  const convertMarkdownToStyledText = (markdown: string): React.ReactNode => {
    const htmlText = marked.parse(markdown, { async: false });
    // HTMLをパースしてスタイル付きのテキストに変換
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlText;

    const convertNodeToStyledText = (node: Node): React.ReactNode => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        const children = Array.from(element.childNodes).map(
          convertNodeToStyledText
        );

        switch (element.tagName.toLowerCase()) {
          case "h1":
            return <Text style={{ fontSize: 16 }}>{children}</Text>; // 通常+6
          case "h2":
            return <Text style={{ fontSize: 14 }}>{children}</Text>; // 通常+4
          case "h3":
            return <Text style={{ fontSize: 12 }}>{children}</Text>; // 通常+2
          case "strong":
          case "b":
            return <Text style={{ fontWeight: "bold" }}>{children}</Text>;
          case "em":
          case "i":
            return <Text style={{ fontStyle: "italic" }}>{children}</Text>;
          case "code":
            return <Text style={{ fontFamily: "Courier" }}>{children}</Text>;
          case "ul":
            return <View style={{ marginLeft: 10 }}>{children}</View>;
          case "li":
            return <Text>• {children}</Text>;
          default:
            return <Text>{children}</Text>;
        }
      }

      return null;
    };

    return convertNodeToStyledText(tempDiv);
  };

  const TestResultPDF = ({ result }: { result: TestResult }) => {
    const counts = calculateStatusCounts(result);

    return (
      <Document>
        {/* 表紙 */}
        <Page size="A4" orientation="landscape" style={styles.page}>
          <View style={styles.coverTitle}>
            <Text style={styles.coverTitleText}>{testSuiteName}</Text>
            <Text style={styles.coverSubTitleText}>{testSuiteId}</Text>
          </View>

          {/* 押印欄 */}
          <View style={styles.stampSection}>
            <View style={styles.stampTable}>
              <View style={styles.stampRow}>
                <Text style={styles.stampHeader}>承認</Text>
                <Text style={styles.stampHeader}>照査</Text>
                <Text style={styles.stampHeader}>作成</Text>
              </View>
              <View style={styles.stampRow}>
                <Text style={styles.stampCell}></Text>
                <Text style={styles.stampCell}></Text>
                <Text style={styles.stampCell}></Text>
              </View>
            </View>
          </View>
        </Page>

        {/* テスト結果ページ */}
        <Page size="A4" orientation="landscape" style={styles.page}>
          <View style={styles.summary}>
            <View style={[styles.summaryItem, { backgroundColor: "#e8f5e9" }]}>
              <Text>OK: {counts.OK}</Text>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: "#ffebee" }]}>
              <Text>NG: {counts.NG}</Text>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: "#fff3e0" }]}>
              <Text>N/A: {counts.NA}</Text>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: "#f5f5f5" }]}>
              <Text>未実施: {counts.Unmarked}</Text>
            </View>
          </View>

          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.testCase]}>
                テストケース
              </Text>
              <Text style={[styles.tableCell, styles.step]}>手順</Text>
              <Text style={[styles.tableCell, styles.expected]}>期待値</Text>
              <Text style={[styles.tableCell, styles.result]}>結果</Text>
              <Text style={[styles.tableCell, styles.comment]}>コメント</Text>
            </View>
            {result.test_results.map((testResult) => {
              const testCase = testCases.find(
                (tc) => tc.id === testResult.test_case_id
              );
              return testResult.results.map((result, stepIndex) => (
                <View
                  key={`${testResult.test_case_id}-${stepIndex}`}
                  style={styles.tableRow}
                >
                  {stepIndex === 0 && (
                    <View style={[styles.tableCell, styles.testCase]}>
                      {convertMarkdownToStyledText(
                        testCase?.name || "不明なテストケース"
                      )}
                    </View>
                  )}
                  {stepIndex !== 0 && (
                    <Text style={[styles.tableCell, styles.testCase]}></Text>
                  )}
                  <View style={[styles.tableCell, styles.step]}>
                    {convertMarkdownToStyledText(result.step)}
                  </View>
                  <View style={[styles.tableCell, styles.expected]}>
                    {convertMarkdownToStyledText(result.expected)}
                  </View>
                  <Text style={[styles.tableCell, styles.result]}>
                    {result.status}
                  </Text>
                  <View style={[styles.tableCell, styles.comment]}>
                    {convertMarkdownToStyledText(result.comment)}
                  </View>
                </View>
              ));
            })}
          </View>
        </Page>
      </Document>
    );
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
        const blob = await pdf(
          <TestResultPDF result={selectedResult} />
        ).toBlob();
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
                    <th className="border border-gray-300 px-4 py-2">
                      テストケース
                    </th>
                    <th className="border border-gray-300 px-4 py-2">手順</th>
                    <th className="border border-gray-300 px-4 py-2">期待値</th>
                    <th className="border border-gray-300 px-4 py-2">結果</th>
                    <th className="border border-gray-300 px-4 py-2">
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
                      <tr
                        key={`${testResult.test_case_id}-${stepIndex}`}
                        className={`${
                          selectedResult.test_results.indexOf(testResult) %
                            2 ===
                          0
                            ? "bg-blue-50"
                            : "bg-green-50"
                        }`}
                      >
                        {stepIndex === 0 && (
                          <td
                            className="border border-gray-300 px-4 py-2"
                            rowSpan={testResult.results.length}
                          >
                            <div>
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {testCase?.name || "不明なテストケース"}
                              </ReactMarkdown>
                            </div>
                          </td>
                        )}
                        <td className="border border-gray-300 px-4 py-2">
                          <div className="prose">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {result.step}
                            </ReactMarkdown>
                          </div>
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          <div className="prose">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {result.expected}
                            </ReactMarkdown>
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
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {result.comment}
                            </ReactMarkdown>
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
