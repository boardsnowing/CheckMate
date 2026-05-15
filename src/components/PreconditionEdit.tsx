import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PreconditionDetails } from "../types/TestCase";
import { parseLegacyPrecondition, generateUnifiedPrecondition, isEmpty } from "../utils/preconditionUtils";

interface PreconditionEditProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (details: PreconditionDetails) => void;
  initialPrecondition?: string;
  initialDetails?: PreconditionDetails;
}

interface AccordionSectionProps {
  title: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function AccordionSection({
  title,
  value,
  onChange,
  placeholder,
  isExpanded,
  onToggle,
}: AccordionSectionProps) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="border rounded mb-2">
      <div className="bg-gray-100 p-3 border-b">
        <div className="flex justify-between items-center">
          <button
            onClick={onToggle}
            className="flex items-center space-x-2 flex-grow text-left"
          >
            <span className="transform transition-transform duration-200">
              {isExpanded ? "▼" : "▶"}
            </span>
            <span className="font-medium">{title}</span>
            {value && (
              <span className="text-sm text-gray-600 ml-2">({value.length}文字)</span>
            )}
          </button>
          {isExpanded && value && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showPreview ? "編集" : "プレビュー"}
            </button>
          )}
        </div>
      </div>
      {isExpanded && (
        <div className="p-3">
          {showPreview && value ? (
            <div className="prose prose-sm max-w-none border rounded p-3 bg-gray-50">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {value}
              </ReactMarkdown>
            </div>
          ) : (
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className={`w-full p-2 border rounded resize-y ${
                title === "事前準備" ? "h-40 min-h-40" : "h-32 min-h-32"
              }`}
              placeholder={placeholder}
              style={{ maxHeight: "300px" }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function PreconditionEdit({
  isOpen,
  onClose,
  onSave,
  initialPrecondition = "",
  initialDetails,
}: PreconditionEditProps) {
  const [details, setDetails] = useState<PreconditionDetails>({});
  const [expandedSections, setExpandedSections] = useState({
    purpose: true,
    environment: false,
    tools: false,
    preparation: false,
  });

  useEffect(() => {
    if (initialDetails) {
      // 新形式のデータが渡された場合
      setDetails(initialDetails);
    } else if (initialPrecondition) {
      // レガシー形式のデータを変換
      const parsed = parseLegacyPrecondition(initialPrecondition);
      setDetails(parsed);

      // 値が設定されている項目を自動展開
      setExpandedSections({
        purpose: !!parsed.purpose,
        environment: !!parsed.environment,
        tools: !!parsed.tools,
        preparation: !!parsed.preparation || true, // preparationは常に表示
      });
    } else {
      // 新規作成時
      setDetails({});
      setExpandedSections({
        purpose: true,
        environment: false,
        tools: false,
        preparation: false,
      });
    }
  }, [initialPrecondition, initialDetails, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(details);
    onClose();
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const updateDetail = (field: keyof PreconditionDetails, value: string) => {
    setDetails(prev => ({
      ...prev,
      [field]: value || undefined
    }));
  };

  const hasContent = !isEmpty(details);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-11/12 h-5/6 flex flex-col p-4 max-w-4xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">前提条件の編集</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mb-4">
            <AccordionSection
              title="目的"
              value={details.purpose || ""}
              onChange={(value) => updateDetail("purpose", value)}
              placeholder="テストの目的や実現したい目標を記述してください（Markdown形式で記述可能）"
              isExpanded={expandedSections.purpose}
              onToggle={() => toggleSection("purpose")}
            />

            <AccordionSection
              title="環境"
              value={details.environment || ""}
              onChange={(value) => updateDetail("environment", value)}
              placeholder="テスト実行に必要な環境や条件を記述してください（Markdown形式で記述可能）"
              isExpanded={expandedSections.environment}
              onToggle={() => toggleSection("environment")}
            />

            <AccordionSection
              title="使用ツール"
              value={details.tools || ""}
              onChange={(value) => updateDetail("tools", value)}
              placeholder="テストで使用するツールやソフトウェアを記述してください（Markdown形式で記述可能）"
              isExpanded={expandedSections.tools}
              onToggle={() => toggleSection("tools")}
            />

            <AccordionSection
              title="事前準備"
              value={details.preparation || ""}
              onChange={(value) => updateDetail("preparation", value)}
              placeholder="テスト実行前に行う準備や設定を記述してください（Markdown形式で記述可能）"
              isExpanded={expandedSections.preparation}
              onToggle={() => toggleSection("preparation")}
            />
          </div>

          {hasContent && (
            <div className="mt-4 p-3 bg-gray-50 border rounded">
              <h3 className="text-sm font-medium text-gray-700 mb-2">統合プレビュー</h3>
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {generateUnifiedPrecondition(details)}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 mt-4 border-t pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

export default PreconditionEdit;
