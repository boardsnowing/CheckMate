import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TestStep } from "../types/TestCase";

interface TestTemplate {
  id: string;
  name: string;
  description: string;
  steps: TestStep[];
}

interface TestTemplateSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (steps: TestStep[]) => void;
}

const TestTemplateSelectModal: React.FC<TestTemplateSelectModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const [templates, setTemplates] = useState<TestTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    try {
      const loadedTemplates = await invoke<TestTemplate[]>("get_test_templates");
      setTemplates(loadedTemplates);
      setError(null);
    } catch (err) {
      setError("テンプレートの読み込みに失敗しました");
      console.error("Failed to load templates:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">テンプレートを選択</h2>
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
            {templates.length === 0 ? (
              <p className="text-gray-500">テンプレートがありません</p>
            ) : (
              <div className="grid gap-4">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      onSelect(template.steps);
                      onClose();
                    }}
                  >
                    <h3 className="font-semibold mb-2">{template.name}</h3>
                    {template.description && (
                      <p className="text-gray-600 mb-2">{template.description}</p>
                    )}
                    <div className="text-sm text-gray-500">
                      ステップ数: {template.steps.length}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TestTemplateSelectModal;
