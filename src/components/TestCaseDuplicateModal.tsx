import { TestCase } from "../types/TestCase";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";

interface TestCaseDuplicateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (insertIndex: number) => void;
  testCases: TestCase[];
  sourceIndex: number;
}

const TestCaseDuplicateModal: React.FC<TestCaseDuplicateModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  testCases,
  sourceIndex,
}) => {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 mb-4"
                >
                  複製したテストケースの挿入位置を選択
                </Dialog.Title>

                <div className="mt-2 space-y-2">
                  {/* 先頭に挿入するオプション */}
                  <button
                    onClick={() => onSelect(0)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded"
                  >
                    先頭に挿入
                  </button>

                  {/* 各テストケースの後に挿入するオプション */}
                  {testCases.map((testCase, index) => (
                    <button
                      key={index}
                      onClick={() => onSelect(index + 1)}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-100 rounded ${
                        index === sourceIndex ? "bg-gray-100" : ""
                      }`}
                      disabled={index === sourceIndex}
                    >
                      {`「${testCase.name}」の後に挿入`}
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm font-medium text-gray-900 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                    onClick={onClose}
                  >
                    キャンセル
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default TestCaseDuplicateModal;
