import { marked } from "marked";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
  Font,
} from "@react-pdf/renderer";
import { TestCase, PreconditionDetails } from "../types/TestCase";
import { generateUnifiedPrecondition } from "../utils/preconditionUtils";

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


// フォント登録
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
  testCase: { width: "20%" },
  no: { width: "5%" },
  step: { width: "20%" },
  expected: { width: "25%" },
  result: { width: "10%" },
  comment: { width: "20%" },
});

// MarkdownをHTMLに変換し、スタイル付きのテキストに変換する関数
const convertMarkdownToStyledText = (markdown: string): React.ReactNode => {
  const htmlText = marked.parse(markdown, { async: false });
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

// ステータス集計関数
const calculateStatusCounts = (result: TestResult) => {
  const counts = {
    OK: 0,
    NG: 0,
    NA: 0,
    Unmarked: 0,
  };

  result.test_results.forEach((testResult) => {
    let hasUnmarked = false;
    let hasNG = false;
    let validSteps = 0;

    testResult.results.forEach(step => {
      if (step.status === "N/A") return;

      if (!step.status || step.status === "") {
        hasUnmarked = true;
      } else if (step.status === "NG") {
        hasNG = true;
      } else if (step.status === "OK") {
        validSteps++;
      }
    });

    if (hasUnmarked) counts.Unmarked++;
    else if (hasNG) counts.NG++;
    else if (validSteps > 0) counts.OK++;
    else counts.NA++;
  });

  return counts;
};

// PDFドキュメントコンポーネント
export const TestResultPDF = ({
  result,
  testSuiteName,
  testSuitePrecondition,
  testSuitePreconditionDetails,
  testCases
}: {
  result: TestResult;
  testSuiteName: string;
  testSuitePrecondition?: string;
  testSuitePreconditionDetails?: PreconditionDetails;
  testCases: TestCase[];
}) => {
  const counts = calculateStatusCounts(result);

  // テストケース単位の集計を計算
  const testCaseSummary = result.test_results.map((testResult) => {
    const testCase = testCases.find((tc) => tc.id === testResult.test_case_id);
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

    return {
      name: testCase?.name || "不明なテストケース",
      counts: statusCounts
    };
  });

  return (
    <Document>
      {/* 表紙 */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.coverTitle}>
          <Text style={styles.coverTitleText}>{testSuiteName}</Text>
        </View>
      </Page>

      {/* 集計ページ */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={{ fontSize: 18, marginBottom: 20 }}>テスト結果集計</Text>

        {/* 全体集計 */}
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

        {/* テストケース単位の集計テーブル */}
        <View style={[styles.table, { marginTop: 20, marginBottom: 40 }]}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, { width: "10%" }]}>No.</Text>
            <Text style={[styles.tableCell, { width: "50%" }]}>テストケース</Text>
            <Text style={[styles.tableCell, { width: "13%" }]}>OK</Text>
            <Text style={[styles.tableCell, { width: "13%" }]}>NG</Text>
            <Text style={[styles.tableCell, { width: "14%" }]}>N/A</Text>
          </View>
          {testCaseSummary.map((summary, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[
                styles.tableCell,
                { width: "10%" },
                summary.counts.NG > 0 ? { backgroundColor: "#ffebee" } :
                summary.counts.NA > 0 && summary.counts.OK === 0 ? { backgroundColor: "#fff3e0" } :
                summary.counts.OK > 0 ? { backgroundColor: "#e8f5e9" } : {}
              ]}>{index + 1}</Text>
              <View style={[styles.tableCell, { width: "50%" }]}>
                {convertMarkdownToStyledText(summary.name)}
              </View>
              <Text style={[styles.tableCell, { width: "13%" }]}>{summary.counts.OK}</Text>
              <Text style={[styles.tableCell, { width: "13%" }]}>{summary.counts.NG}</Text>
              <Text style={[styles.tableCell, { width: "14%" }]}>{summary.counts.NA}</Text>
            </View>
          ))}
        </View>
      </Page>

      {/* 前提条件ページ */}
      {(testSuitePreconditionDetails || testSuitePrecondition) && (() => {
        // 4項目データがある場合は統合表示、ない場合はレガシー表示
        const displayPrecondition = testSuitePreconditionDetails
          ? generateUnifiedPrecondition(testSuitePreconditionDetails)
          : testSuitePrecondition;

        return displayPrecondition && (
          <Page size="A4" orientation="landscape" style={styles.page}>
            <Text style={{ fontSize: 18, marginBottom: 20 }}>前提条件</Text>
            <View style={{ padding: 10, backgroundColor: "#f9f9f9", borderRadius: 5 }}>
              {convertMarkdownToStyledText(displayPrecondition)}
            </View>
          </Page>
        );
      })()}

      {/* テスト結果詳細ページ */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={{ fontSize: 18, marginBottom: 20 }}>テスト結果詳細</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, styles.testCase]}>テストケース</Text>
            <Text style={[styles.tableCell, styles.no]}>No</Text>
            <Text style={[styles.tableCell, styles.step]}>手順</Text>
            <Text style={[styles.tableCell, styles.expected]}>期待値</Text>
            <Text style={[styles.tableCell, styles.result]}>結果</Text>
            <Text style={[styles.tableCell, styles.comment]}>コメント</Text>
          </View>
          {result.test_results.map((testResult, index) => {
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
                <Text style={[styles.tableCell, styles.no]}>
                  {`${index + 1}-${stepIndex + 1}`}
                </Text>
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

// PDFエクスポート関数
export const exportTestResultToPDF = async (
  result: TestResult,
  testSuiteName: string,
  testCases: TestCase[],
  testSuitePrecondition?: string,
  testSuitePreconditionDetails?: PreconditionDetails
): Promise<Blob> => {
  const pdfDocument = (
    <TestResultPDF
      result={result}
      testSuiteName={testSuiteName}
      testSuitePrecondition={testSuitePrecondition}
      testSuitePreconditionDetails={testSuitePreconditionDetails}
      testCases={testCases}
    />
  );

  return await pdf(pdfDocument).toBlob();
};

// PDFExporterクラス（ファクトリーパターン）
export class PDFExporter {
  constructor(
    private testSuiteName: string,
    private testSuitePrecondition: string,
    private testSuitePreconditionDetails: PreconditionDetails | undefined,
    private testCases: TestCase[]
  ) {}

  async exportToPDF(result: TestResult): Promise<Blob> {
    return await exportTestResultToPDF(
      result,
      this.testSuiteName,
      this.testCases,
      this.testSuitePrecondition,
      this.testSuitePreconditionDetails
    );
  }
}

export default PDFExporter;