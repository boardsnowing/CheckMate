import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { convertFileSrc } from "@tauri-apps/api/core";
import { PreconditionDetails } from "../types/TestCase";
import { generateUnifiedPrecondition, isEmpty } from "../utils/preconditionUtils";

interface PreconditionViewProps {
  precondition?: string;
  preconditionDetails?: PreconditionDetails;
  onEdit: () => void;
}

interface SectionViewProps {
  title: string;
  content: string;
}

function SectionView({ title, content }: SectionViewProps) {
  return (
    <div className="mb-3">
      <h4 className="text-sm font-semibold text-gray-700 mb-1">## {title}</h4>
      <div className="pl-3 border-l-2 border-gray-200">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            img: ({ node, ...props }) => {
              const convertedSrc = convertFileSrc(props.src || "");
              return (
                <img {...props} src={convertedSrc} alt={props.alt || ""} />
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

function PreconditionView({
  precondition,
  preconditionDetails,
  onEdit,
}: PreconditionViewProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [viewMode, setViewMode] = useState<"structured" | "unified">("unified");

  // 4項目形式のデータがあるかチェック
  const hasStructuredData = preconditionDetails && !isEmpty(preconditionDetails);
  const hasLegacyData = precondition && precondition.trim() !== "";

  // データが何もない場合
  if (!hasStructuredData && !hasLegacyData) {
    return (
      <div className="mb-4 p-4 border rounded bg-gray-50">
        <div className="flex justify-between items-center">
          <span className="text-gray-500">前提条件なし</span>
          <button
            onClick={onEdit}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            追加
          </button>
        </div>
      </div>
    );
  }

  // 表示用のコンテンツを決定
  const displayContent = hasStructuredData ? generateUnifiedPrecondition(preconditionDetails!) : precondition!;

  return (
    <div className="mb-4 border rounded bg-gray-50">
      <div className="flex justify-between items-center p-2 bg-gray-100 border-b">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-2"
        >
          <span className="transform transition-transform duration-200">
            {isExpanded ? "▼" : "▶"}
          </span>
          <span className="font-medium">前提条件</span>
        </button>
        <div className="flex items-center space-x-2">
          {hasStructuredData && (
            <div className="flex bg-white rounded border text-xs">
              <button
                onClick={() => setViewMode("structured")}
                className={`px-2 py-1 rounded-l ${
                  viewMode === "structured"
                    ? "bg-blue-500 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                項目別
              </button>
              <button
                onClick={() => setViewMode("unified")}
                className={`px-2 py-1 rounded-r ${
                  viewMode === "unified"
                    ? "bg-blue-500 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                統合
              </button>
            </div>
          )}
          <button
            onClick={onEdit}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            編集
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="p-3">
          {hasStructuredData && viewMode === "structured" ? (
            // 4項目表示モード
            <div className="space-y-3">
              {preconditionDetails!.purpose && (
                <SectionView title="目的" content={preconditionDetails!.purpose} />
              )}
              {preconditionDetails!.environment && (
                <SectionView title="環境" content={preconditionDetails!.environment} />
              )}
              {preconditionDetails!.tools && (
                <SectionView title="使用ツール" content={preconditionDetails!.tools} />
              )}
              {preconditionDetails!.preparation && (
                <SectionView title="事前準備" content={preconditionDetails!.preparation} />
              )}
            </div>
          ) : (
            // 統合表示モード（レガシーデータまたは統合表示）
            <div className="markdown">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  img: ({ node, ...props }) => {
                    const convertedSrc = convertFileSrc(props.src || "");
                    return (
                      <img {...props} src={convertedSrc} alt={props.alt || ""} />
                    );
                  },
                }}
              >
                {displayContent}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PreconditionView;
