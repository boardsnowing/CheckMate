import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

interface TestResult {
  test_suite_id: string;
  test_suite_name: string;
  test_run_name: string;
  executed_by: string;
  executed_at: string;
  test_results: TestCaseResultData[];
}

interface ConflictItem {
  caseId: string;
  stepIndex: number;
  file1Result: TestStepResult;
  file2Result: TestStepResult;
}

const TestResultMerge = () => {
  const { suiteId } = useParams<{ suiteId: string }>();
  const navigate = useNavigate();
  const [file1, setFile1] = useState<TestResult | null>(null);
  const [file2, setFile2] = useState<TestResult | null>(null);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [mergedResult, setMergedResult] = useState<TestResult | null>(null);
  const [selectedFile1Items, setSelectedFile1Items] = useState<Set<string>>(new Set());
  const [selectedFile2Items, setSelectedFile2Items] = useState<Set<string>>(new Set());
  const [outputFileName, setOutputFileName] = useState("");
  const [previousResults, setPreviousResults] = useState<TestResult[]>([]);

  useEffect(() => {
    loadPreviousResults();
  }, [suiteId]);

  const loadPreviousResults = async () => {
    if (!suiteId) return;
    try {
      const results = await invoke<TestResult[]>("get_test_results", {
        testSuiteId: suiteId,
      });
      setPreviousResults(results);
    } catch (error) {
      console.error("Failed to load test results:", error);
    }
  };

  // ファイル選択時の処理
  const handleFileSelect = async (fileNumber: 1 | 2, fileName: string) => {
    try {
      const result = await invoke<TestResult>("load_test_result", {
        testSuiteId: suiteId,
        fileName,
      });

      if (fileNumber === 1) {
        setFile1(result);
      } else {
        setFile2(result);
      }

      // 両方のファイルが選択された場合、重複チェックを実行
      if ((fileNumber === 1 && file2) || (fileNumber === 2 && file1)) {
        const otherFile = fileNumber === 1 ? file2 : file1;
        const currentFile = result;
        checkConflicts(currentFile, otherFile!);
      }
    } catch (error) {
      console.error("Failed to load test result:", error);
      alert("テスト結果の読み込みに失敗しました");
    }
  };

  // 重複チェック
  const checkConflicts = (file1: TestResult, file2: TestResult) => {
    const newConflicts: ConflictItem[] = [];

    file1.test_results.forEach((result1) => {
      const matchingResult = file2.test_results.find(
        (result2) => result2.test_case_id === result1.test_case_id
      );

      if (matchingResult) {
        result1.results.forEach((step1, stepIndex) => {
          const step2 = matchingResult.results[stepIndex];
          if (
            step1.status !== step2.status ||
            step1.comment !== step2.comment
          ) {
            newConflicts.push({
              caseId: result1.test_case_id,
              stepIndex,
              file1Result: step1,
              file2Result: step2,
            });
          }
        });
      }
    });

    setConflicts(newConflicts);
  };

  // 結果の選択処理
  const handleResultSelection = (conflictId: string, fileNumber: 1 | 2) => {
    const [caseId, stepIndex] = conflictId.split("-");
    if (fileNumber === 1) {
      setSelectedFile1Items(new Set([...selectedFile1Items, conflictId]));
      setSelectedFile2Items(
        new Set([...selectedFile2Items].filter((id) => id !== conflictId))
      );
    } else {
      setSelectedFile2Items(new Set([...selectedFile2Items, conflictId]));
      setSelectedFile1Items(
        new Set([...selectedFile1Items].filter((id) => id !== conflictId))
      );
    }
  };

  // すべての競合が解決されているかチェック
  const areAllConflictsResolved = () => {
    return conflicts.every((conflict) => {
      const conflictId = `${conflict.caseId}-${conflict.stepIndex}`;
      return selectedFile1Items.has(conflictId) || selectedFile2Items.has(conflictId);
    });
  };

  // マージ処理
  const handleMerge = async () => {
    if (!file1 || !file2) return;

    if (!areAllConflictsResolved()) {
      alert("すべての競合を解決してください");
      return;
    }

    if (!outputFileName.trim()) {
      alert("出力ファイル名を入力してください");
      return;
    }

    // マージ結果の作成
    const mergedTestResults = [...file1.test_results];
    file2.test_results.forEach((result2) => {
      const existingIndex = mergedTestResults.findIndex(
        (result1) => result1.test_case_id === result2.test_case_id
      );

      if (existingIndex === -1) {
        // 重複がない場合は追加
        mergedTestResults.push(result2);
      } else {
        // 重複がある場合は選択された結果を使用
        result2.results.forEach((step2, stepIndex) => {
          const conflictId = `${result2.test_case_id}-${stepIndex}`;
          if (selectedFile2Items.has(conflictId)) {
            mergedTestResults[existingIndex].results[stepIndex] = step2;
          }
        });
      }
    });

    const merged: TestResult = {
      ...file1,
      test_run_name: `${outputFileName.trim()}.json`,
      executed_at: new Date().toISOString(),
      test_results: mergedTestResults,
    };

    try {
      await invoke("save_test_result", {
        testSuiteId: merged.test_suite_id,
        testResults: merged.test_results,
        fileName: merged.test_run_name,
      });

      alert("マージ結果を保存しました");
      setMergedResult(merged);
    } catch (error) {
      console.error("Failed to save merged result:", error);
      alert("マージ結果の保存に失敗しました");
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">試験結果マージ</h2>
        <button
          onClick={() => navigate(`/test-cases/${suiteId}`)}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          戻る
        </button>
      </div>

      {/* ファイル選択部分 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="border p-4 rounded">
          <h3 className="font-bold mb-2">ファイル1</h3>
          <select
            className="w-full p-2 border rounded mb-4"
            onChange={(e) => handleFileSelect(1, e.target.value)}
            value={file1?.test_run_name || ""}
          >
            <option value="">選択してください</option>
            {previousResults.map((result) => (
              <option key={result.test_run_name} value={result.test_run_name}>
                {result.test_run_name} ({result.executed_by} - {new Date(result.executed_at).toLocaleString()})
              </option>
            ))}
          </select>
          {file1 && (
            <div className="text-sm">
              <p>実行者: {file1.executed_by}</p>
              <p>実行日時: {new Date(file1.executed_at).toLocaleString()}</p>
            </div>
          )}
        </div>
        <div className="border p-4 rounded">
          <h3 className="font-bold mb-2">ファイル2</h3>
          <select
            className="w-full p-2 border rounded mb-4"
            onChange={(e) => handleFileSelect(2, e.target.value)}
            value={file2?.test_run_name || ""}
          >
            <option value="">選択してください</option>
            {previousResults
              .filter((result) => result.test_run_name !== file1?.test_run_name)
              .map((result) => (
                <option key={result.test_run_name} value={result.test_run_name}>
                  {result.test_run_name} ({result.executed_by} - {new Date(result.executed_at).toLocaleString()})
                </option>
              ))}
          </select>
          {file2 && (
            <div className="text-sm">
              <p>実行者: {file2.executed_by}</p>
              <p>実行日時: {new Date(file2.executed_at).toLocaleString()}</p>
            </div>
          )}
        </div>
      </div>

      {/* 競合表示部分 */}
      {conflicts.length > 0 && (
        <div className="mb-6">
          <h3 className="font-bold mb-2">競合の解決</h3>
          <div className="border rounded">
            {conflicts.map((conflict) => (
              <div
                key={`${conflict.caseId}-${conflict.stepIndex}`}
                className="p-4 border-b last:border-b-0"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-bold mb-2">ファイル1の結果</h4>
                    <div className="prose">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {conflict.file1Result.step}
                      </ReactMarkdown>
                      <p>結果: {conflict.file1Result.status}</p>
                      <p>コメント: {conflict.file1Result.comment}</p>
                    </div>
                    <button
                      className={`mt-2 px-4 py-2 rounded ${
                        selectedFile1Items.has(
                          `${conflict.caseId}-${conflict.stepIndex}`
                        )
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200"
                      }`}
                      onClick={() =>
                        handleResultSelection(
                          `${conflict.caseId}-${conflict.stepIndex}`,
                          1
                        )
                      }
                    >
                      この結果を使用
                    </button>
                  </div>
                  <div>
                    <h4 className="font-bold mb-2">ファイル2の結果</h4>
                    <div className="prose">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {conflict.file2Result.step}
                      </ReactMarkdown>
                      <p>結果: {conflict.file2Result.status}</p>
                      <p>コメント: {conflict.file2Result.comment}</p>
                    </div>
                    <button
                      className={`mt-2 px-4 py-2 rounded ${
                        selectedFile2Items.has(
                          `${conflict.caseId}-${conflict.stepIndex}`
                        )
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200"
                      }`}
                      onClick={() =>
                        handleResultSelection(
                          `${conflict.caseId}-${conflict.stepIndex}`,
                          2
                        )
                      }
                    >
                      この結果を使用
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 出力ファイル名入力 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700">
          出力ファイル名：
        </label>
        <div className="mt-1 flex rounded-md shadow-sm">
          <input
            type="text"
            value={outputFileName}
            onChange={(e) => setOutputFileName(e.target.value)}
            className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
            placeholder="保存するファイル名を入力"
          />
          <span className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
            .json
          </span>
        </div>
      </div>

      {/* マージボタン */}
      <button
        className={`px-4 py-2 rounded ${
          !areAllConflictsResolved() || !file1 || !file2 || !outputFileName.trim()
            ? "bg-gray-300 cursor-not-allowed"
            : "bg-blue-500 text-white hover:bg-blue-600"
        }`}
        onClick={handleMerge}
        disabled={!areAllConflictsResolved() || !file1 || !file2 || !outputFileName.trim()}
      >
        マージ実行
      </button>
    </div>
  );
};

export default TestResultMerge;
