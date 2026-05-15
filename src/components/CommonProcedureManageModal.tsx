import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CommonProcedure } from "../types/TestCase";

interface CommonProcedureManageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function CommonProcedureManageModal({
  isOpen,
  onClose,
}: CommonProcedureManageModalProps) {
  const [procedures, setProcedures] = useState<CommonProcedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingProcedure, setEditingProcedure] = useState<CommonProcedure | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProcedures();
    }
  }, [isOpen]);

  const loadProcedures = async () => {
    try {
      const loadedProcedures = await invoke<CommonProcedure[]>("get_common_procedures");
      setProcedures(loadedProcedures);
      setError(null);
    } catch (err) {
      setError("共通手順の読み込みに失敗しました");
      console.error("Failed to load common procedures:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    const newProcedure: CommonProcedure = {
      id: `cp-${Date.now()}`,
      name: "",
      description: "",
      steps: [{ step: "", expected: "" }],
    };
    setEditingProcedure(newProcedure);
    setIsCreating(true);
  };

  const handleEdit = (procedure: CommonProcedure) => {
    setEditingProcedure({ ...procedure });
    setIsCreating(false);
  };

  const handleSave = async () => {
    if (!editingProcedure) return;

    try {
      if (isCreating) {
        await invoke("save_common_procedure", { procedure: editingProcedure });
      } else {
        await invoke("update_common_procedure", { procedure: editingProcedure });
      }
      await loadProcedures();
      setEditingProcedure(null);
      setIsCreating(false);
    } catch (err) {
      setError(`共通手順の保存に失敗しました: ${err}`);
    }
  };

  const handleDelete = async (procedureId: string) => {
    if (!confirm("この共通手順を削除しますか？")) return;

    try {
      await invoke("delete_common_procedure", { procedureId });
      await loadProcedures();
    } catch (err) {
      setError(`共通手順の削除に失敗しました: ${err}`);
    }
  };

  const handleCancel = () => {
    setEditingProcedure(null);
    setIsCreating(false);
  };

  const addStep = () => {
    if (!editingProcedure) return;
    setEditingProcedure({
      ...editingProcedure,
      steps: [...editingProcedure.steps, { step: "", expected: "" }],
    });
  };

  const removeStep = (index: number) => {
    if (!editingProcedure || editingProcedure.steps.length <= 1) return;
    setEditingProcedure({
      ...editingProcedure,
      steps: editingProcedure.steps.filter((_, i) => i !== index),
    });
  };

  const updateStep = (index: number, field: "step" | "expected", value: string) => {
    if (!editingProcedure) return;
    const updatedSteps = [...editingProcedure.steps];
    updatedSteps[index][field] = value;
    setEditingProcedure({
      ...editingProcedure,
      steps: updatedSteps,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">共通手順管理</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {editingProcedure ? (
          // 編集モード
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    名称
                  </label>
                  <input
                    type="text"
                    value={editingProcedure.name}
                    onChange={(e) =>
                      setEditingProcedure({
                        ...editingProcedure,
                        name: e.target.value,
                      })
                    }
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                    placeholder="共通手順の名称"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    説明
                  </label>
                  <input
                    type="text"
                    value={editingProcedure.description}
                    onChange={(e) =>
                      setEditingProcedure({
                        ...editingProcedure,
                        description: e.target.value,
                      })
                    }
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                    placeholder="共通手順の説明"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-medium text-gray-700">
                    共通手順ステップ
                  </label>
                  <button
                    onClick={addStep}
                    className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                  >
                    +追加
                  </button>
                </div>
                <div className="space-y-1">
                  {editingProcedure.steps.map((step, index) => (
                    <div key={index} className="flex items-center space-x-1">
                      <span className="text-xs text-gray-500 w-6">{index + 1}.</span>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={step.step}
                          onChange={(e) => updateStep(index, "step", e.target.value)}
                          className="w-full p-1 border border-gray-300 rounded text-xs"
                          placeholder="手順"
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={step.expected}
                          onChange={(e) => updateStep(index, "expected", e.target.value)}
                          className="w-full p-1 border border-gray-300 rounded text-xs"
                          placeholder="期待値"
                        />
                      </div>
                      <button
                        onClick={() => removeStep(index)}
                        className="px-1 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 w-6 h-6 flex items-center justify-center"
                        disabled={editingProcedure.steps.length <= 1}
                        title="削除"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  onClick={handleCancel}
                  className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                  disabled={!editingProcedure.name.trim()}
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        ) : (
          // リストモード
          <div className="flex-1 overflow-y-auto">
            <div className="mb-4">
              <button
                onClick={handleCreateNew}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                新しい共通手順を作成
              </button>
            </div>

            {loading ? (
              <div className="text-center py-4">読み込み中...</div>
            ) : (
              <div className="space-y-1">
                {procedures.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">共通手順がありません</p>
                ) : (
                  procedures.map((procedure) => (
                    <div
                      key={procedure.id}
                      className="p-2 border rounded hover:bg-gray-50"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm truncate">{procedure.name}</h3>
                            <span className="text-xs text-gray-500 whitespace-nowrap">{procedure.steps.length}ステップ</span>
                          </div>
                          {procedure.description && (
                            <p className="text-xs text-gray-600 truncate mt-1">{procedure.description}</p>
                          )}
                        </div>
                        <div className="flex space-x-1 ml-2">
                          <button
                            onClick={() => handleEdit(procedure)}
                            className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(procedure.id)}
                            className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CommonProcedureManageModal;