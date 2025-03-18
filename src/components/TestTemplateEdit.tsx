import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TestStep } from "../types/TestCase";

interface TestTemplate {
  id: string;
  name: string;
  description: string;
  steps: TestStep[];
}

interface TestTemplateEditProps {
  onSave: (template: TestTemplate) => void;
  onCancel: () => void;
}

const TestTemplateEdit: React.FC<TestTemplateEditProps> = ({
  onSave,
  onCancel,
}) => {
  const { templateId } = useParams<{ templateId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<TestTemplate>({
    id: templateId || `template-${Date.now()}`,
    name: "",
    description: "",
    steps: [{ step: "", expected: "" }],
  });

  useEffect(() => {
    if (templateId) {
      loadTemplate();
    } else {
      setLoading(false);
    }
  }, [templateId]);

  const loadTemplate = async () => {
    try {
      const loadedTemplate = await invoke<TestTemplate>("get_test_template", {
        templateId,
      });
      setTemplate(loadedTemplate);
      setError(null);
    } catch (err) {
      setError("テンプレートの読み込みに失敗しました");
      console.error("Failed to load template:", err);
    } finally {
      setLoading(false);
    }
  };
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // キーボードショートカットの設定
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "p") {
        setIsPreviewMode((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // テンプレート名の更新
  const handleNameChange = (value: string) => {
    setTemplate((prev) => ({ ...prev, name: value }));
  };

  // テンプレートの説明を更新
  const handleDescriptionChange = (value: string) => {
    setTemplate((prev) => ({ ...prev, description: value }));
  };

  // ステップの更新
  const handleUpdateStep = (
    stepIndex: number,
    field: "step" | "expected",
    value: string
  ) => {
    const updatedSteps = [...template.steps];
    updatedSteps[stepIndex][field] = value;
    setTemplate((prev) => ({ ...prev, steps: updatedSteps }));
  };

  // ステップの追加
  const handleAddStep = () => {
    setTemplate((prev) => ({
      ...prev,
      steps: [...prev.steps, { step: "", expected: "" }],
    }));
  };

  // ステップの削除
  const handleDeleteStep = (stepIndex: number) => {
    if (template.steps.length > 1) {
      const updatedSteps = template.steps.filter(
        (_, index) => index !== stepIndex
      );
      setTemplate((prev) => ({ ...prev, steps: updatedSteps }));
    }
  };

  // ステップの挿入
  const handleInsertStep = (stepIndex: number) => {
    const updatedSteps = [...template.steps];
    updatedSteps.splice(stepIndex + 1, 0, { step: "", expected: "" });
    setTemplate((prev) => ({ ...prev, steps: updatedSteps }));
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">
          {templateId ? "テンプレート編集" : "テンプレート作成"}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => onSave(template)}
            className="px-4 py-2 bg-blue-500 text-white rounded"
            disabled={!template.name.trim() || !template.steps[0].step.trim()}
          >
            保存
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-500 text-white rounded"
          >
            キャンセル
          </button>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          テンプレート名
        </label>
        {isPreviewMode ? (
          <div className="p-2 border rounded bg-gray-50">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {template.name}
            </ReactMarkdown>
          </div>
        ) : (
          <input
            type="text"
            value={template.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="テンプレート名を入力"
          />
        )}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          説明
        </label>
        {isPreviewMode ? (
          <div className="p-2 border rounded bg-gray-50">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {template.description}
            </ReactMarkdown>
          </div>
        ) : (
          <textarea
            value={template.description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            className="w-full p-2 border rounded h-24"
            placeholder="テンプレートの説明を入力"
          />
        )}
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-700">
            テスト手順
          </label>
          <button
            onClick={handleAddStep}
            className="px-3 py-1 bg-green-500 text-white rounded text-sm"
          >
            手順を追加
          </button>
        </div>

        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 w-16">No.</th>
              <th className="border border-gray-300 px-4 py-2">手順</th>
              <th className="border border-gray-300 px-4 py-2">期待値</th>
              <th className="border border-gray-300 px-4 py-2 w-32">操作</th>
            </tr>
          </thead>
          <tbody>
            {template.steps.map((step, index) => (
              <tr key={index} className="border border-gray-300">
                <td className="border border-gray-300 px-4 py-2 text-center">
                  {index + 1}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {isPreviewMode ? (
                    <div className="markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {step.step}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <textarea
                      value={step.step}
                      onChange={(e) =>
                        handleUpdateStep(index, "step", e.target.value)
                      }
                      className="w-full p-2 border rounded h-24"
                      placeholder="手順を入力"
                    />
                  )}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {isPreviewMode ? (
                    <div className="markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {step.expected}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <textarea
                      value={step.expected}
                      onChange={(e) =>
                        handleUpdateStep(index, "expected", e.target.value)
                      }
                      className="w-full p-2 border rounded h-24"
                      placeholder="期待値を入力"
                    />
                  )}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleInsertStep(index)}
                      className="px-2 py-1 bg-blue-500 text-white rounded text-sm"
                    >
                      挿入
                    </button>
                    {template.steps.length > 1 && (
                      <button
                        onClick={() => handleDeleteStep(index)}
                        className="px-2 py-1 bg-red-500 text-white rounded text-sm"
                      >
                        削除
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TestTemplateEdit;
