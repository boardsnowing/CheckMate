import React, { useState, useEffect } from 'react';

interface PreconditionEditProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (precondition: string) => void;
  initialPrecondition?: string;
}

const PreconditionEdit: React.FC<PreconditionEditProps> = ({
  isOpen,
  onClose,
  onSave,
  initialPrecondition = ''
}) => {
  const [precondition, setPrecondition] = useState(initialPrecondition);

  useEffect(() => {
    setPrecondition(initialPrecondition);
  }, [initialPrecondition]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(precondition);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-11/12 h-5/6 flex flex-col p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">前提条件の編集</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        <textarea
          value={precondition}
          onChange={(e) => setPrecondition(e.target.value)}
          className="flex-1 w-full p-2 border rounded resize-none mb-4"
          placeholder="前提条件を入力してください（Markdown形式で記述可能）"
        />
        <div className="flex justify-end space-x-2">
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
};

export default PreconditionEdit;
