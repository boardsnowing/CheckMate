import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface PreconditionViewProps {
  precondition?: string;
  onEdit: () => void;
}

const PreconditionView: React.FC<PreconditionViewProps> = ({
  precondition,
  onEdit
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!precondition || precondition.trim() === '') {
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

  return (
    <div className="mb-4 border rounded bg-gray-50">
      <div className="flex justify-between items-center p-2 bg-gray-100 border-b">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-2"
        >
          <span className="transform transition-transform duration-200">
            {isExpanded ? '▼' : '▶'}
          </span>
          <span className="font-medium">前提条件</span>
        </button>
        <button
          onClick={onEdit}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
        >
          編集
        </button>
      </div>
      {isExpanded && (
        <div className="markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{precondition}</ReactMarkdown>
        </div>
      )}
    </div>
  );
};

export default PreconditionView;
