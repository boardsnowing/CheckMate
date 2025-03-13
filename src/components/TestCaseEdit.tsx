import { TestCase } from "../types/TestCase";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, useEffect } from "react";

interface TestCaseEditProps {
  testCases: TestCase[];
  onTestCaseChange: (updatedCases: TestCase[]) => void;
  onAddTestCase: () => void;
  onSave: () => void;
}

const TestCaseEdit: React.FC<TestCaseEditProps> = ({
  testCases,
  onTestCaseChange,
  onAddTestCase,
  onSave,
}) => {
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // キーボードショートカットのイベントハンドラ
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "s") {
        event.preventDefault(); // ブラウザのデフォルトの保存動作を防ぐ
        onSave(); // 強制的に保存を実行
      }
      // Alt + P でプレビューモードを切り替え
      if (event.altKey && event.key === "p") {
        event.preventDefault();
        setIsPreviewMode((prev) => !prev);
      }
    };

    // イベントリスナーを追加
    document.addEventListener("keydown", handleKeyDown);

    // クリーンアップ関数
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onSave]);

  // テストケースを削除
  const deleteTestCase = (caseIndex: number) => {
    const updatedCases = testCases.filter((_, index) => index !== caseIndex);
    onTestCaseChange(updatedCases);
  };

  // テストケースにステップを追加（末尾に追加）
  const addStep = (caseIndex: number) => {
    const updatedCases = [...testCases];
    updatedCases[caseIndex].steps.push({
      step: "新しい手順",
      expected: "期待値",
    });
    onTestCaseChange(updatedCases);
  };

  // テストケースの特定の位置にステップを挿入
  const handleInsertStep = (caseIndex: number, stepIndex: number) => {
    const updatedCases = [...testCases];
    updatedCases[caseIndex].steps.splice(stepIndex + 1, 0, {
      step: "",
      expected: "",
    });
    onTestCaseChange(updatedCases);
  };

  // テストケースからステップを削除
  const deleteStep = (caseIndex: number, stepIndex: number) => {
    const updatedCases = [...testCases];
    updatedCases[caseIndex].steps = updatedCases[caseIndex].steps.filter(
      (_, index) => index !== stepIndex
    );
    onTestCaseChange(updatedCases);
  };

  // 編集内容を反映する関数
  const handleUpdateStep = (
    caseIndex: number,
    stepIndex: number,
    field: "step" | "expected",
    value: string
  ) => {
    const updatedCases = [...testCases];
    updatedCases[caseIndex].steps[stepIndex][field] = value;
    onTestCaseChange(updatedCases);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={onAddTestCase}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          テストケース追加
        </button>
        <div className="text-sm text-gray-500">Alt + P でプレビュー切替</div>
      </div>

      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-gray-300 px-2 py-1 w-24 min-w-[6rem] max-w-[6rem]">
              No
            </th>
            <th className="border border-gray-300 px-2 py-1">手順</th>
            <th className="border border-gray-300 px-2 py-1">期待値</th>
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
                <td className="border border-gray-300 px-2 py-1 w-24 min-w-[6rem] max-w-[6rem]">
                  <div className="flex flex-col space-y-1">
                    <span>{caseIndex + 1}.</span>
                    <button
                      onClick={() => addStep(caseIndex)}
                      className="px-1 py-0.5 bg-blue-500 text-white rounded text-xs"
                    >
                      ステップ追加
                    </button>
                    <button
                      onClick={() => deleteTestCase(caseIndex)}
                      className="px-1 py-0.5 bg-red-500 text-white rounded text-xs"
                    >
                      ステップ削除
                    </button>
                  </div>
                </td>
                <td className="border border-gray-300 px-2 py-1" colSpan={2}>
                  {isPreviewMode ? (
                    <div className="markdown p-1">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {testCase.name}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <textarea
                      placeholder="テストケースの概要を入力"
                      value={testCase.name}
                      onChange={(e) => {
                        const updatedCases = [...testCases];
                        updatedCases[caseIndex].name = e.target.value;
                        onTestCaseChange(updatedCases);
                      }}
                      className="w-full p-1 border rounded h-[6em]"
                    />
                  )}
                </td>
              </tr>
              {/* テストケースのステップ */}
              {testCase.steps.map((step, stepIndex) => (
                <tr
                  key={`${caseIndex}-step-${stepIndex}`}
                  className={`border border-gray-300 ${
                    caseIndex % 2 === 0 ? "bg-blue-50" : "bg-green-50"
                  }`}
                >
                  <td className="border border-gray-300 px-2 py-1 w-24 min-w-[6rem] max-w-[6rem]">
                    <div className="flex flex-col space-y-1">
                      <span className="text-sm">{`${caseIndex + 1}-${
                        stepIndex + 1
                      }`}</span>
                      <button
                        onClick={() => handleInsertStep(caseIndex, stepIndex)}
                        className="px-1 py-0.5 bg-blue-500 text-white rounded text-xs"
                      >
                        挿入
                      </button>
                      <button
                        onClick={() => deleteStep(caseIndex, stepIndex)}
                        className="px-1 py-0.5 bg-red-500 text-white rounded text-xs"
                      >
                        削除
                      </button>
                    </div>
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    <div className="relative">
                      {isPreviewMode ? (
                        <div className="markdown">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {step.step}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div>
                          <textarea
                            placeholder="手順"
                            value={step.step}
                            onChange={(e) =>
                              handleUpdateStep(
                                caseIndex,
                                stepIndex,
                                "step",
                                e.target.value
                              )
                            }
                            className="w-full p-1 border rounded h-[6em]"
                          />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    <div className="relative">
                      {isPreviewMode ? (
                        <div className="markdown">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {step.expected}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div>
                          <textarea
                            placeholder="期待値"
                            value={step.expected}
                            onChange={(e) =>
                              handleUpdateStep(
                                caseIndex,
                                stepIndex,
                                "expected",
                                e.target.value
                              )
                            }
                            className="w-full p-1 border rounded h-[6em]"
                          />
                        </div>
                      )}
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
                <td
                  colSpan={3}
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

export default TestCaseEdit;
