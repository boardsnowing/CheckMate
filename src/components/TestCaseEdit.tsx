import { TestCase } from "../types/TestCase";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, useEffect } from "react";
import TestTemplateSelectModal from "./TestTemplateSelectModal";
import TestCaseDuplicateModal from "./TestCaseDuplicateModal";

interface TestCaseEditProps {
  testCases: TestCase[];
  onTestCaseChange: (updatedCases: TestCase[]) => void;
  onSave: () => void;
}

const TestCaseEdit: React.FC<TestCaseEditProps> = ({
  testCases,
  onTestCaseChange,
  onSave,
}) => {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [collapsedCases, setCollapsedCases] = useState<number[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    caseIndex: number;
    stepIndex?: number;
    visible: boolean;
  }>({
    x: 0,
    y: 0,
    caseIndex: -1,
    stepIndex: undefined,
    visible: false,
  });

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [selectedStepIndex, setSelectedStepIndex] = useState<{
    caseIndex: number;
    stepIndex: number;
  } | null>(null);
  const [duplicateSourceIndex, setDuplicateSourceIndex] = useState<number>(-1);

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

  // 指定位置にテストケースを挿入
  const insertTestCase = (caseIndex: number) => {
    const updatedCases = [...testCases];
    updatedCases.splice(caseIndex + 1, 0, {
      id: `tc-${testCases.length + 1}`,
      name: "新しいテストケース",
      steps: [
        {
          step: "",
          expected: "",
        },
      ],
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

  // コンテキストメニューを閉じる
  const handleClickOutside = () => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  // コンテキストメニューのクリックイベントハンドラーを設定
  useEffect(() => {
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  // 右クリックイベントハンドラー
  const handleContextMenu = (
    event: React.MouseEvent,
    caseIndex: number,
    stepIndex?: number
  ) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      caseIndex,
      stepIndex,
      visible: true,
    });
  };

  return (
    <div>
      <TestCaseDuplicateModal
        isOpen={isDuplicateModalOpen}
        onClose={() => setIsDuplicateModalOpen(false)}
        onSelect={(insertIndex) => {
          const sourceCase = testCases[duplicateSourceIndex];
          const duplicatedCase = {
            ...JSON.parse(JSON.stringify(sourceCase)),
            id: `tc-${testCases.length + 1}`,
          };
          const updatedCases = [...testCases];
          updatedCases.splice(insertIndex, 0, duplicatedCase);
          onTestCaseChange(updatedCases);
          setIsDuplicateModalOpen(false);
        }}
        testCases={testCases}
        sourceIndex={duplicateSourceIndex}
      />
      <TestTemplateSelectModal
        isOpen={isTemplateModalOpen}
        onClose={() => {
          setIsTemplateModalOpen(false);
          setSelectedStepIndex(null);
        }}
        onSelect={(templateSteps) => {
          if (selectedStepIndex) {
            const updatedCases = [...testCases];
            const { caseIndex, stepIndex } = selectedStepIndex;

            // テンプレートのステップを選択位置の後に挿入
            updatedCases[caseIndex].steps.splice(
              stepIndex + 1,
              0,
              ...templateSteps
            );

            onTestCaseChange(updatedCases);
          }
        }}
      />
      {/* コンテキストメニュー */}
      {contextMenu.visible && (
        <div
          className="fixed bg-white shadow-lg border rounded-lg py-2 z-50"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          {contextMenu.stepIndex === undefined ? (
            <>
              <button
                onClick={() => {
                  insertTestCase(contextMenu.caseIndex);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-100"
              >
                テストケースを挿入
              </button>
              <button
                onClick={() => {
                  setDuplicateSourceIndex(contextMenu.caseIndex);
                  setIsDuplicateModalOpen(true);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-100"
              >
                テストケースを複製
              </button>
              <button
                onClick={() => {
                  deleteTestCase(contextMenu.caseIndex);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 text-red-600"
              >
                テストケースを削除
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  handleInsertStep(
                    contextMenu.caseIndex,
                    contextMenu.stepIndex!
                  );
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-100"
              >
                テストステップを挿入
              </button>
              <button
                onClick={() => {
                  setSelectedStepIndex({
                    caseIndex: contextMenu.caseIndex,
                    stepIndex: contextMenu.stepIndex!,
                  });
                  setIsTemplateModalOpen(true);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-100"
              >
                テンプレートを挿入
              </button>
              <button
                onClick={() => {
                  deleteStep(contextMenu.caseIndex, contextMenu.stepIndex!);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 text-red-600"
              >
                テストステップを削除
              </button>
            </>
          )}
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              const newTestCase: TestCase = {
                id: `tc-${testCases.length + 1}`,
                name: "新しいテストケース",
                steps: [
                  {
                    step: "",
                    expected: "",
                  },
                ],
              };
              onTestCaseChange([...testCases, newTestCase]);
            }}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            テストケース追加
          </button>
          <div className="flex items-center gap-4">
            <div className="text-sm">
              テストケース数:{" "}
              <span className="font-bold">{testCases.length}</span>
            </div>
            <button
              onClick={toggleAllCollapse}
              className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
            >
              {collapsedCases.length === testCases.length
                ? "すべて展開"
                : "すべて折りたたむ"}
            </button>
          </div>
        </div>
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
                onContextMenu={(e) => handleContextMenu(e, caseIndex)}
              >
                <td className="border border-gray-300 px-2 py-1 w-24 min-w-[6rem] max-w-[6rem]">
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => toggleCollapse(caseIndex)}
                      className="w-6 h-6 mb-1 bg-gray-200 rounded hover:bg-gray-300 flex items-center justify-center"
                    >
                      {collapsedCases.includes(caseIndex) ? "+" : "-"}
                    </button>
                    <span>{caseIndex + 1}.</span>
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
              {!collapsedCases.includes(caseIndex) &&
                testCase.steps.map((step, stepIndex) => (
                  <tr
                    key={`${caseIndex}-step-${stepIndex}`}
                    className={`border border-gray-300 ${
                      caseIndex % 2 === 0 ? "bg-blue-50" : "bg-green-50"
                    }`}
                    onContextMenu={(e) =>
                      handleContextMenu(e, caseIndex, stepIndex)
                    }
                  >
                    <td className="border border-gray-300 px-2 py-1 w-24 min-w-[6rem] max-w-[6rem]">
                      <div className="flex justify-center">
                        <span className="text-sm">{`${caseIndex + 1}-${
                          stepIndex + 1
                        }`}</span>
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
