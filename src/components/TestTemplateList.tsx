import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { TestStep } from "../types/TestCase";

interface TestTemplate {
  id: string;
  name: string;
  description: string;
  steps: TestStep[];
}

function TestTemplateList() {
  const [templates, setTemplates] = useState<TestTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const loadedTemplates = await invoke<TestTemplate[]>(
        "get_test_templates"
      );
      setTemplates(loadedTemplates);
      setError(null);
    } catch (err) {
      setError("テンプレートの読み込みに失敗しました");
      console.error("Failed to load templates:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm("このテンプレートを削除してもよろしいですか？")) {
      return;
    }

    try {
      await invoke("delete_test_template", { templateId });
      await loadTemplates(); // 一覧を再読み込み
    } catch (err) {
      setError("テンプレートの削除に失敗しました");
      console.error("Failed to delete template:", err);
    }
  };

  if (loading) {
    return <div className="p-4">読み込み中...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">テストテンプレート一覧</h1>
        </div>
        <Link
          to="/template/create"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          新規作成
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <Link
          to="/"
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          戻る
        </Link>
      </div>

      {templates.length === 0 ? (
        <p className="text-gray-500">テンプレートがありません</p>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="p-4 border rounded-lg bg-white shadow-sm"
            >
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-lg font-semibold">{template.name}</h2>
                <div className="flex gap-2">
                  <Link
                    to={`/template/edit/${template.id}`}
                    className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
                  >
                    編集
                  </Link>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                  >
                    削除
                  </button>
                </div>
              </div>
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
  );
};

export default TestTemplateList;
