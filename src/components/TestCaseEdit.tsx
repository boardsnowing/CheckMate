import { TestCase, CommonProcedure } from "../types/TestCase";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, useEffect } from "react";
import TestTemplateSelectModal from "./TestTemplateSelectModal";
import TestCaseDuplicateModal from "./TestCaseDuplicateModal";
import CommonProcedureSelectModal from "./CommonProcedureSelectModal";
import CommonProcedureManageModal from "./CommonProcedureManageModal";
import Step from "./common/Step";

interface TestCaseEditProps {
  testCases: TestCase[];
  onTestCaseChange: (updatedCases: TestCase[]) => void;
  onSave: () => void;
}

function TestCaseEdit({
  testCases,
  onTestCaseChange,
  onSave,
}: TestCaseEditProps) {
  // 最大のテストケースIDを取得する関数
  const getMaxTestCaseId = () => {
    return testCases.reduce((max, testCase) => {
      const currentId = parseInt(testCase.id.replace('tc-', ''));
      return currentId > max ? currentId : max;
    }, 0);
  };

  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [collapsedCases, setCollapsedCases] = useState<number[]>([]);
  const [commonProcedureGroupCollapsed, setCommonProcedureGroupCollapsed] = useState<{ [key: string]: boolean }>({});
  // key: `${caseIndex}-${procedureId}` でテストケースごとに独立管理
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
  const [isCommonProcedureSelectModalOpen, setIsCommonProcedureSelectModalOpen] = useState(false);
  const [isCommonProcedureManageModalOpen, setIsCommonProcedureManageModalOpen] = useState(false);
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
      id: `tc-${getMaxTestCaseId() + 1}`,
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
    const updatedCases = testCases.map((tc, i) =>
      i === caseIndex
        ? { ...tc, steps: [...tc.steps.slice(0, stepIndex + 1), { step: "", expected: "" }, ...tc.steps.slice(stepIndex + 1)] }
        : tc
    );
    onTestCaseChange(updatedCases);
  };

  // テストケースからステップを削除
  const deleteStep = (caseIndex: number, stepIndex: number) => {
    const updatedCases = testCases.map((tc, i) =>
      i === caseIndex
        ? { ...tc, steps: tc.steps.filter((_, idx) => idx !== stepIndex) }
        : tc
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
    const updatedCases = testCases.map((tc, i) => {
      if (i !== caseIndex) return tc;
      const steps = tc.steps.map((s, j) =>
        j === stepIndex ? { ...s, [field]: value } : s
      );
      return { ...tc, steps };
    });
    onTestCaseChange(updatedCases);
  };

  const handleInsertCommonProcedure = (procedure: CommonProcedure) => {
    if (!selectedStepIndex) return;
    const { caseIndex, stepIndex } = selectedStepIndex;

    const procedureSteps = procedure.steps.map((step) => ({
      step: step.step,
      expected: step.expected,
      commonProcedureRef: {
        procedureId: procedure.id,
        procedureName: procedure.name,
      },
    }));

    const updatedCases = testCases.map((tc, i) => {
      if (i !== caseIndex) return tc;
      const steps = [
        ...tc.steps.slice(0, stepIndex + 1),
        ...procedureSteps,
        ...tc.steps.slice(stepIndex + 1),
      ];
      return { ...tc, steps };
    });

    onTestCaseChange(updatedCases);
  };

  const toggleCommonProcedureGroup = (caseIndex: number, procedureId: string) => {
    const key = `${caseIndex}-${procedureId}`;
    setCommonProcedureGroupCollapsed(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
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
            id: `tc-${getMaxTestCaseId() + 1}`,
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
            const { caseIndex, stepIndex } = selectedStepIndex;
            const updatedCases = testCases.map((tc, i) => {
              if (i !== caseIndex) return tc;
              const steps = [
                ...tc.steps.slice(0, stepIndex + 1),
                ...templateSteps,
                ...tc.steps.slice(stepIndex + 1),
              ];
              return { ...tc, steps };
            });
            onTestCaseChange(updatedCases);
          }
        }}
      />
      <CommonProcedureSelectModal
        isOpen={isCommonProcedureSelectModalOpen}
        onClose={() => {
          setIsCommonProcedureSelectModalOpen(false);
          setSelectedStepIndex(null);
        }}
        onSelect={handleInsertCommonProcedure}
      />
      <CommonProcedureManageModal
        isOpen={isCommonProcedureManageModalOpen}
        onClose={() => setIsCommonProcedureManageModalOpen(false)}
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
                  setSelectedStepIndex({
                    caseIndex: contextMenu.caseIndex,
                    stepIndex: contextMenu.stepIndex!,
                  });
                  setIsCommonProcedureSelectModalOpen(true);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-100"
              >
                共通手順を挿入
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
                id: `tc-${getMaxTestCaseId() + 1}`,
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
          <button
            onClick={() => setIsCommonProcedureManageModalOpen(true)}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            共通手順管理
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
                        const name = e.target.value;
                        onTestCaseChange(testCases.map((tc, i) =>
                          i === caseIndex ? { ...tc, name } : tc
                        ));
                      }}
                      className="w-full p-1 border rounded h-[6em]"
                    />
                  )}
                </td>
              </tr>
              {/* テストケースのステップ */}
              {!collapsedCases.includes(caseIndex) &&
                testCase.steps.map((step, stepIndex) => (
                  <Step
                    key={`${caseIndex}-step-${stepIndex}`}
                    step={step}
                    prevStep={stepIndex > 0 ? testCase.steps[stepIndex - 1] : undefined}
                    caseIndex={caseIndex}
                    stepIndex={stepIndex}
                    mode="edit"
                    isPreviewMode={isPreviewMode}
                    alternatingColor={caseIndex % 2 === 0 ? "blue" : "green"}
                    onStepChange={(field, value) =>
                      handleUpdateStep(caseIndex, stepIndex, field, value)
                    }
                    onContextMenu={(e) =>
                      handleContextMenu(e, caseIndex, stepIndex)
                    }
                    commonProcedureGroupCollapsed={commonProcedureGroupCollapsed}
                    onToggleCommonProcedureGroup={toggleCommonProcedureGroup}
                  />
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
