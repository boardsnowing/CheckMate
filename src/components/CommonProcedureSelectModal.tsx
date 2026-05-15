import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CommonProcedure } from "../types/TestCase";

interface CommonProcedureSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (procedure: CommonProcedure) => void;
}

function CommonProcedureSelectModal({
  isOpen,
  onClose,
  onSelect,
}: CommonProcedureSelectModalProps) {
  const [procedures, setProcedures] = useState<CommonProcedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">共通手順を選択</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="text-center py-4">読み込み中...</div>
        ) : error ? (
          <div className="text-red-500 py-4">{error}</div>
        ) : (
          <div className="overflow-y-auto flex-1">
            {procedures.length === 0 ? (
              <p className="text-gray-500 text-center py-4">共通手順がありません</p>
            ) : (
              <div className="space-y-1">
                {procedures.map((procedure) => (
                  <div
                    key={procedure.id}
                    className="p-2 border rounded hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      onSelect(procedure);
                      onClose();
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-sm">{procedure.name}</h3>
                      <span className="text-xs text-gray-500">{procedure.steps.length}ステップ</span>
                    </div>
                    {procedure.description && (
                      <p className="text-xs text-gray-600 mt-1 overflow-hidden"
                         style={{
                           display: '-webkit-box',
                           WebkitLineClamp: 2,
                           WebkitBoxOrient: 'vertical'
                         }}>
                        {procedure.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CommonProcedureSelectModal;