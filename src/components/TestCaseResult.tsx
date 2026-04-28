import { TestCase, TestStep } from "../types/TestCase";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Step from "./common/Step";

interface TestCaseResultProps {
  testCases: TestCase[];
  testSuiteId: string;
  testSuiteName: string;
  onTestResultChange: (
    caseIndex: number,
    stepIndex: number,
    result: "OK" | "NG" | "N/A",
    caseResult: "OK" | "NG" | "未実施"
  ) => void;
}

interface TestStepResult {
  step: string;
  expected: string;
  status: string;
  comment: string;
}

interface TestCaseResultData {
  test_case_id: string;
  result: "OK" | "NG" | "未実施";
  results: TestStepResult[];
}

function TestCaseResult({
  testCases,
  testSuiteId,
  testSuiteName,
  onTestResultChange,
}: TestCaseResultProps) {
  // テスト結果の集計を計算する関数
  const calculateCurrentStatusCounts = () => {
    const counts = {
      OK: 0,
      NG: 0,
      NA: 0,
      Unmarked: 0,
    };

    testCases.forEach((testCase) => {
      if (testCase.result === "OK") counts.OK++;
      else if (testCase.result === "NG") counts.NG++;
      else counts.Unmarked++;
    });

    return counts;
  };

  const [comments, setComments] = useState<{ [key: string]: string }>({});
  const [fileName, setFileName] = useState<string>("");
  const [previousResults, setPreviousResults] = useState<any[]>([]);
  const [selectedResult, setSelectedResult] = useState<string>("");
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [collapsedCases, setCollapsedCases] = useState<number[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [autoSaveStartTime, setAutoSaveStartTime] = useState<number | null>(
    null
  );

  const toggleAllCollapse = () => {
    if (collapsedCases.length === testCases.length) {
      setCollapsedCases([]);
    } else {
      setCollapsedCases(testCases.map((_, index) => index));
    }
  };

  const toggleCollapse = (caseIndex: number) => {
    setCollapsedCases((prev) =>
      prev.includes(caseIndex)
        ? prev.filter((i) => i !== caseIndex)
        : [...prev, caseIndex]
    );
  };

  // 保存処理を共通関数として切り出し
  const saveTestResult = async () => {
    if (!fileName.trim()) {
      alert("ファイル名を入力してください");
      return false;
    }

    const testResults: TestCaseResultData[] = testCases.map((testCase) => {
      const caseResult = judgeTestCase(testCase.steps);
      return {
        test_case_id: testCase.id,
        result: caseResult,
        results: testCase.steps.map((step, stepIndex) => ({
          step: step.step,
          expected: step.expected,
          status: step.result || "未実施",
          comment: comments[`${testCases.indexOf(testCase)}-${stepIndex}`] || "",
        })),
      };
    });

    const fullFileName = `${fileName.trim()}.json`;
    try {
      // ファイルの存在確認
      const exists = await invoke<boolean>("check_test_result_exists", {
        testSuiteId,
        fileName: fullFileName,
      });

      if (exists) {
        // 上書き確認
        if (
          !window.confirm("同名のファイルが既に存在します。上書きしますか？")
        ) {
          return false;
        }
      }

      // テスト結果を保存
      await invoke("save_test_result", {
        testSuiteId,
        testResults,
        fileName: fullFileName,
      });
      await loadPreviousResults(); // 保存後にリストを更新
      setIsDirty(false);
      return true;
    } catch (error) {
      console.error("Failed to save test result:", error);
      alert("テスト結果の保存に失敗しました");
      return false;
    }
  };

  // キーボードショートカットのイベントハンドラ
  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      // Alt + P でプレビューモードを切り替え
      if (event.altKey && event.key === "p") {
        event.preventDefault();
        setIsPreviewMode((prev) => !prev);
      }
      // Ctrl + S で保存
      if (event.ctrlKey && event.key === "s") {
        event.preventDefault();
        await saveTestResult();
      }
    };

    // イベントリスナーを追加
    document.addEventListener("keydown", handleKeyDown);

    // クリーンアップ関数
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    isPreviewMode,
    fileName,
    comments,
    testCases,
    testSuiteId,
    testSuiteName,
  ]);

  // テスト結果が変更されたときの処理
  useEffect(() => {
    if (!isDirty) {
      setAutoSaveStartTime(Date.now());
    }
    setIsDirty(true);
  }, [testCases, comments]);

  // 自動保存の処理
  useEffect(() => {
    if (!autoSaveStartTime || !fileName.trim()) return;

    const timer = setTimeout(async () => {
      const success = await saveTestResult();
      if (success) {
        setIsDirty(false);
        setAutoSaveStartTime(null);
      }
    }, 10000); // 10秒後に自動保存

    return () => {
      clearTimeout(timer);
    };
  }, [autoSaveStartTime, fileName, comments, testCases]);

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

  // テストケースの判定を行う関数
  const judgeTestCase = (steps: TestStep[]): "OK" | "NG" | "未実施" => {
    let hasUnmarked = false;
    let hasNG = false;
    let validSteps = 0;

    steps.forEach(step => {
      if (step.result === "N/A") return; // N/Aは判定から除外
      
      if (!step.result) {
        hasUnmarked = true;
      } else if (step.result === "NG") {
        hasNG = true;
      } else if (step.result === "OK") {
        validSteps++;
      }
    });

    if (hasUnmarked) return "未実施";
    if (hasNG) return "NG";
    return validSteps > 0 ? "OK" : "未実施";
  };

  const loadTestResult = (result: any) => {
    // コメントと結果を復元
    const newComments: { [key: string]: string } = {};
    result.test_results.forEach((testResult: any) => {
      testResult.results.forEach((stepResult: any, stepIndex: number) => {
        const testCase = testCases.find(
          (tc) => tc.id === testResult.test_case_id
        );
        if (testCase) {
          const caseIndex = testCases.indexOf(testCase);
          newComments[`${caseIndex}-${stepIndex}`] = stepResult.comment;
          const status = stepResult.status as "OK" | "NG" | "N/A";
          const caseResult = judgeTestCase(testCase.steps);
          onTestResultChange(
            caseIndex,
            stepIndex,
            status,
            caseResult
          );
        }
      });
    });
    setComments(newComments);
    setFileName(result.test_run_name.replace(/\.json$/, ""));
  };

  return (
    <div>
      {/* テスト結果の集計表示 */}
      <div className="bg-white p-4 rounded shadow mb-4">
        {(() => {
          const counts = calculateCurrentStatusCounts();
          return (
            <div className="flex space-x-4">
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

      <div className="mt-4 space-y-4 mb-4">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">
            過去のテスト結果:
          </label>
          <select
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            value={selectedResult}
            onChange={(e) => {
              setSelectedResult(e.target.value);
              const result = previousResults.find(
                (r) => r.test_run_name === e.target.value
              );
              if (result) {
                loadTestResult(result);
              }
            }}
          >
            <option value="">選択してください</option>
            {previousResults.map((result, index) => (
              <option key={index} value={result.test_run_name}>
                {result.test_run_name} ({result.executed_by} -{" "}
                {new Date(result.executed_at).toLocaleString()})
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <label
              htmlFor="fileName"
              className="text-sm font-medium text-gray-700"
            >
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
              const success = await saveTestResult();
              if (success) {
                alert("テスト結果を保存しました");
              }
            }}
          >
            テスト結果を保存
          </button>
        </div>
      </div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <button
            onClick={toggleAllCollapse}
            className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
          >
            {collapsedCases.length === testCases.length
              ? "すべて展開"
              : "すべて折りたたむ"}
          </button>
        </div>
        <div className="text-sm text-gray-500">Alt + P でプレビュー切替</div>
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
                className={`border border-gray-300 ${
                  caseIndex % 2 === 0 ? "bg-blue-50" : "bg-green-50"
                } font-semibold`}
              >
                <td className="border border-gray-300 px-2 py-1">
                  <div className="flex items-center">
                    <button
                      onClick={() => toggleCollapse(caseIndex)}
                      className="w-6 h-6 mr-2 bg-gray-200 rounded hover:bg-gray-300 flex items-center justify-center"
                    >
                      {collapsedCases.includes(caseIndex) ? "+" : "-"}
                    </button>
                    <span>{caseIndex + 1}.</span>
                  </div>
                </td>
                <td colSpan={2} className="border border-gray-300 px-2 py-1">
                  <div className="prose flex items-center">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {testCase.name}
                    </ReactMarkdown>
                  </div>
                </td>
                <td colSpan={1} className="border border-gray-300 px-2 py-1">
                  <div className={`px-3 py-1 rounded text-center ${
                    testCase.result === "OK" ? "bg-green-100 text-green-800" :
                    testCase.result === "NG" ? "bg-red-100 text-red-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>
                    {testCase.result || "未実施"}
                  </div>
                </td>
              </tr>
              {/* テストケースのステップ */}
              {!collapsedCases.includes(caseIndex) &&
                testCase.steps.map((step, stepIndex) => (
                  <Step
                    key={`${caseIndex}-step-${stepIndex}`}
                    step={step}
                    caseIndex={caseIndex}
                    stepIndex={stepIndex}
                    mode="result"
                    isPreviewMode={isPreviewMode}
                    alternatingColor={caseIndex % 2 === 0 ? "blue" : "green"}
                    comment={comments[`${caseIndex}-${stepIndex}`] || ""}
                    onResultChange={(result) => {
                      const newSteps = [...testCase.steps];
                      newSteps[stepIndex] = { ...step, result };
                      const caseResult = judgeTestCase(newSteps);
                      onTestResultChange(caseIndex, stepIndex, result, caseResult);
                    }}
                    onCommentChange={(comment) =>
                      setComments({
                        ...comments,
                        [`${caseIndex}-${stepIndex}`]: comment,
                      })
                    }
                  />
                ))}
            </>
          ))}
          {/* テストケース間の区切り線 */}
          {testCases.map((_, index) =>
            index < testCases.length - 1 ? (
              <tr key={`separator-${index}`}>
                <td
                  colSpan={4}
                  className="h-2 border-b-2 border-gray-400 bg-gray-50"
                ></td>
              </tr>
            ) : null
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TestCaseResult;
