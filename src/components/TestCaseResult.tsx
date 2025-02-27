import { TestCase } from "../types/TestCase";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

interface TestCaseResultProps {
  testCases: TestCase[];
  testSuiteId: string;
  testSuiteName: string;
  onTestResultChange: (caseIndex: number, stepIndex: number, result: "OK" | "NG" | "N/A") => void;
}

interface TestStepResult {
  step: string;
  expected: string;
  status: string;
  comment: string;
}

interface TestCaseResultData {
  test_case_id: string;
  results: TestStepResult[];
}

const TestCaseResult: React.FC<TestCaseResultProps> = ({
  testCases,
  testSuiteId,
  testSuiteName,
  onTestResultChange,
}) => {
  const [comments, setComments] = useState<{ [key: string]: string }>({});
  const [fileName, setFileName] = useState<string>("");
  const [previousResults, setPreviousResults] = useState<any[]>([]);
  const [selectedResult, setSelectedResult] = useState<string>("");
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // キーボードショートカットのイベントハンドラ
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Alt + P でプレビューモードを切り替え
      if (event.altKey && event.key === 'p') {
        event.preventDefault();
        setIsPreviewMode(prev => !prev);
      }
    };

    // イベントリスナーを追加
    document.addEventListener('keydown', handleKeyDown);

    // クリーンアップ関数
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPreviewMode]);

  useEffect(() => {
    loadPreviousResults();
  }, [testSuiteId]);

  const loadPreviousResults = async () => {
    try {
      const results = await invoke<any[]>("get_test_results", {
        testSuiteId,
      });
      setPreviousResults(results);
    } catch (error) {
      console.error("テスト結果の読み込みに失敗しました:", error);
    }
  };

  const loadTestResult = (result: any) => {
    // コメントと結果を復元
    const newComments: { [key: string]: string } = {};
    result.test_results.forEach((testResult: any) => {
      testResult.results.forEach((stepResult: any, stepIndex: number) => {
        const testCase = testCases.find(tc => tc.id === testResult.test_case_id);
        if (testCase) {
          const caseIndex = testCases.indexOf(testCase);
          newComments[`${caseIndex}-${stepIndex}`] = stepResult.comment;
          onTestResultChange(caseIndex, stepIndex, stepResult.status as "OK" | "NG" | "N/A");
        }
      });
    });
    setComments(newComments);
    setFileName(result.test_run_name.replace(/\.json$/, ""));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div></div>
        <div className="text-sm text-gray-500">
          Alt + P でプレビュー切替
        </div>
      </div>
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-gray-300 px-2 py-1">No</th>
            <th className="border border-gray-300 px-2 py-1">手順</th>
            <th className="border border-gray-300 px-2 py-1">期待値</th>
            <th className="border border-gray-300 px-2 py-1">判定</th>
          </tr>
        </thead>
        <tbody>
          {testCases.map((testCase, caseIndex) => (
            <>
              {/* テストケース名の行 */}
              <tr
                key={`${caseIndex}-name`}
                className="border border-gray-300 bg-gray-100 font-semibold"
              >
                <td
                  colSpan={4}
                  className="border border-gray-300 px-2 py-1"
                >
                  <div className="flex items-center">
                    <span className="mr-2">{caseIndex + 1}.</span>
                    <span>{testCase.name}</span>
                  </div>
                </td>
              </tr>
              {/* テストケースのステップ */}
              {testCase.steps.map((step, stepIndex) => (
                <tr
                  key={`${caseIndex}-step-${stepIndex}`}
                  className="border border-gray-300"
                >
                  <td className="border border-gray-300 px-2 py-1">
                    <span>{`${caseIndex + 1}-${stepIndex + 1}`}</span>
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    <div className="prose">
                      {isPreviewMode ? (
                        <div className="bg-white p-2 border rounded">
                          <ReactMarkdown>{step.step}</ReactMarkdown>
                        </div>
                      ) : (
                        <ReactMarkdown>{step.step}</ReactMarkdown>
                      )}
                    </div>
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    <div className="prose">
                      {isPreviewMode ? (
                        <div className="bg-white p-2 border rounded">
                          <ReactMarkdown>{step.expected}</ReactMarkdown>
                        </div>
                      ) : (
                        <ReactMarkdown>{step.expected}</ReactMarkdown>
                      )}
                    </div>
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    <div className="flex flex-col space-y-2">
                      <div className="flex space-x-2">
                        <button
                          className={`px-2 py-1 ${
                            step.result === "OK" ? "bg-green-500" : "bg-gray-400"
                          } text-white rounded`}
                          onClick={() => onTestResultChange(caseIndex, stepIndex, "OK")}
                        >
                          OK
                        </button>
                        <button
                          className={`px-2 py-1 ${
                            step.result === "NG" ? "bg-red-500" : "bg-gray-400"
                          } text-white rounded`}
                          onClick={() => onTestResultChange(caseIndex, stepIndex, "NG")}
                        >
                          NG
                        </button>
                        <button
                          className={`px-2 py-1 ${
                            step.result === "N/A" ? "bg-yellow-500" : "bg-gray-400"
                          } text-white rounded`}
                          onClick={() => onTestResultChange(caseIndex, stepIndex, "N/A")}
                        >
                          N/A
                        </button>
                      </div>
                      <div className="space-y-2">
                        {isPreviewMode ? (
                          <div className="prose border rounded p-2 bg-gray-50 min-h-[100px]">
                            <ReactMarkdown>
                              {comments[`${caseIndex}-${stepIndex}`] || '*コメントなし*'}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <textarea
                            placeholder="Markdownでコメントを入力"
                            className="px-2 py-1 border rounded w-[40ch] h-[6em] font-mono"
                            value={comments[`${caseIndex}-${stepIndex}`] || ""}
                            onChange={(e) =>
                              setComments({
                                ...comments,
                                [`${caseIndex}-${stepIndex}`]: e.target.value,
                              })
                            }
                          />
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </>
          ))}
          {/* テストケース間の区切り線 */}
          {testCases.map((_, index) =>
            index < testCases.length - 1 ? (
              <tr key={`separator-${index}`}>
                <td colSpan={4} className="h-2 border-b-2 border-gray-400 bg-gray-50"></td>
              </tr>
            ) : null
          )}
        </tbody>
      </table>
      <div className="mt-4 space-y-4">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">
            過去のテスト結果:
          </label>
          <select
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            value={selectedResult}
            onChange={(e) => {
              setSelectedResult(e.target.value);
              const result = previousResults.find(r => r.test_run_name === e.target.value);
              if (result) {
                loadTestResult(result);
              }
            }}
          >
            <option value="">選択してください</option>
            {previousResults.map((result, index) => (
              <option key={index} value={result.test_run_name}>
                {result.test_run_name} ({result.executed_by} - {new Date(result.executed_at).toLocaleString()})
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <label htmlFor="fileName" className="text-sm font-medium text-gray-700">
              ファイル名：
            </label>
            <input
              id="fileName"
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="保存するファイル名を入力"
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-sm text-gray-500">.json</span>
          </div>
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={async () => {
              const testResults: TestCaseResultData[] = testCases.map((testCase) => ({
                test_case_id: testCase.id,
                results: testCase.steps.map((step, stepIndex) => ({
                  step: step.step,
                  expected: step.expected,
                  status: step.result || "未実施",
                  comment: comments[`${testCases.indexOf(testCase)}-${stepIndex}`] || "",
                })),
              }));

              if (!fileName.trim()) {
                alert("ファイル名を入力してください");
                return;
              }

              const fullFileName = `${fileName.trim()}.json`;
              try {
                // ファイルの存在確認
                const exists = await invoke<boolean>("check_test_result_exists", {
                  testSuiteId,
                  fileName: fullFileName,
                });

                if (exists) {
                  // 上書き確認
                  if (!window.confirm("同名のファイルが既に存在します。上書きしますか？")) {
                    return;
                  }
                }

                // テスト結果を保存
                await invoke("save_test_result", {
                  testSuiteId,
                  testSuiteName,
                  executedBy: "tester1", // TODO: ログインユーザー名を使用
                  testResults,
                  fileName: fullFileName,
                });
                alert("テスト結果を保存しました");
                await loadPreviousResults(); // 保存後にリストを更新
              } catch (error) {
                console.error("Failed to save test result:", error);
                alert("テスト結果の保存に失敗しました");
              }
            }}
          >
            テスト結果を保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestCaseResult;
