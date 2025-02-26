import { TestCase } from "../types/TestCase";
import ReactMarkdown from "react-markdown";
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
      if (event.ctrlKey && event.key === 's') {
        event.preventDefault(); // ブラウザのデフォルトの保存動作を防ぐ
        onSave(); // 強制的に保存を実行
      }
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
  }, [onSave]);

  // テストケースを削除
  const deleteTestCase = (caseIndex: number) => {
    const updatedCases = testCases.filter((_, index) => index !== caseIndex);
    onTestCaseChange(updatedCases);
  };

  // テストケースにステップを追加
  const addStep = (caseIndex: number) => {
    const updatedCases = [...testCases];
    updatedCases[caseIndex].steps.push({
      step: "新しい手順",
      expected: "期待値"
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
                  colSpan={3}
                  className="border border-gray-300 px-2 py-1 flex justify-between items-center"
                >
                  <div className="flex items-center">
                    <span className="mr-2">{caseIndex + 1}.</span>
                    <input
                      type="text"
                      value={testCase.name}
                      onChange={(e) => {
                        const updatedCases = [...testCases];
                        updatedCases[caseIndex].name = e.target.value;
                        onTestCaseChange(updatedCases);
                      }}
                      className="p-1 border rounded"
                    />
                  </div>
                  <div>
                    <button
                      onClick={() => addStep(caseIndex)}
                      className="px-2 py-1 bg-blue-500 text-white rounded mr-2"
                    >
                      ステップ追加
                    </button>
                    <button
                      onClick={() => deleteTestCase(caseIndex)}
                      className="px-2 py-1 bg-red-500 text-white rounded"
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
              {/* テストケースのステップ */}
              {testCase.steps.map((step, stepIndex) => (
                <tr
                  key={`${caseIndex}-step-${stepIndex}`}
                  className="border border-gray-300"
                >
                  <td className="border border-gray-300 px-2 py-1 flex justify-between items-center">
                    <span>{`${caseIndex + 1}-${stepIndex + 1}`}</span>
                    <button
                      onClick={() => deleteStep(caseIndex, stepIndex)}
                      className="px-2 py-1 bg-red-500 text-white rounded text-sm"
                    >
                      削除
                    </button>
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    <div className="relative">
                      {isPreviewMode ? (
                        <div className="bg-white p-2 border rounded">
                          <ReactMarkdown>{step.step}</ReactMarkdown>
                        </div>
                      ) : (
                        <div>
                          <textarea
                            value={step.step}
                            onChange={(e) =>
                              handleUpdateStep(caseIndex, stepIndex, "step", e.target.value)
                            }
                            className="w-full p-1 border rounded min-h-[100px]"
                          />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    <div className="relative">
                      {isPreviewMode ? (
                        <div className="bg-white p-2 border rounded">
                          <ReactMarkdown>{step.expected}</ReactMarkdown>
                        </div>
                      ) : (
                        <div>
                          <textarea
                            value={step.expected}
                            onChange={(e) =>
                              handleUpdateStep(
                                caseIndex,
                                stepIndex,
                                "expected",
                                e.target.value
                              )
                            }
                            className="w-full p-1 border rounded min-h-[100px]"
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
                <td colSpan={3} className="h-2 border-b-2 border-gray-400 bg-gray-50"></td>
              </tr>
            ) : null
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TestCaseEdit;
