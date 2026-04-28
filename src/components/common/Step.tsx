import { TestStep } from "../../types/TestCase";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMemo } from "react";

interface StepProps {
  step: TestStep;
  caseIndex: number;
  stepIndex: number;
  mode: 'edit' | 'result' | 'history';
  isPreviewMode?: boolean;
  alternatingColor: 'blue' | 'green';

  // 編集モード専用
  onStepChange?: (field: 'step' | 'expected', value: string) => void;
  onContextMenu?: (e: React.MouseEvent) => void;

  // 結果モード専用
  comment?: string;
  onResultChange?: (result: 'OK' | 'NG' | 'N/A') => void;
  onCommentChange?: (comment: string) => void;

  // 履歴モード専用
  historyResult?: string;
  historyComment?: string;
  showTestCaseName?: boolean;
  testCaseName?: string;
  totalStepsInCase?: number;
}

function Step({
  step,
  caseIndex,
  stepIndex,
  mode,
  isPreviewMode = false,
  alternatingColor,
  onStepChange,
  onContextMenu,
  comment = "",
  onResultChange,
  onCommentChange,
  historyResult,
  historyComment = "",
  showTestCaseName = false,
  testCaseName = "",
  totalStepsInCase = 0,
}: StepProps) {
  // スタイリングクラス名をuseMemoで最適化
  const stepClassName = useMemo(() =>
    `border border-gray-300 ${
      alternatingColor === 'blue' ? 'bg-blue-50' : 'bg-green-50'
    }`, [alternatingColor]
  );

  // ReactMarkdownコンテンツをuseMemoで最適化
  const stepMarkdown = useMemo(() => (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {step.step}
    </ReactMarkdown>
  ), [step.step]);

  const expectedMarkdown = useMemo(() => (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {step.expected}
    </ReactMarkdown>
  ), [step.expected]);

  const commentMarkdown = useMemo(() => (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {comment || "*コメントなし*"}
    </ReactMarkdown>
  ), [comment]);

  const historyCommentMarkdown = useMemo(() => (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {historyComment || "*コメントなし*"}
    </ReactMarkdown>
  ), [historyComment]);

  const testCaseNameMarkdown = useMemo(() => (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {testCaseName || "不明なテストケース"}
    </ReactMarkdown>
  ), [testCaseName]);

  // ステップ番号の表示
  const stepNumber = `${caseIndex + 1}-${stepIndex + 1}`;

  return (
    <tr
      key={`${caseIndex}-step-${stepIndex}`}
      className={stepClassName}
      onContextMenu={onContextMenu}
    >
      {/* テストケース名列（履歴モードで最初のステップのみ） */}
      {mode === 'history' && showTestCaseName && stepIndex === 0 && (
        <td
          className="border border-gray-300 px-4 py-2"
          rowSpan={totalStepsInCase}
        >
          <div>
            {testCaseNameMarkdown}
          </div>
        </td>
      )}

      {/* No列 */}
      <td className={`border border-gray-300 px-2 py-1 ${mode === 'history' ? 'px-4 py-2 text-center' : 'w-24 min-w-[6rem] max-w-[6rem]'}`}>
        <div className={mode === 'history' ? '' : 'flex justify-center'}>
          <span className={mode === 'history' ? '' : 'text-sm'}>{stepNumber}</span>
        </div>
      </td>

      {/* 手順列 */}
      <td className={`border border-gray-300 ${mode === 'history' ? 'px-4 py-2' : 'px-2 py-1'}`}>
        <div className={mode === 'history' ? 'prose' : 'relative'}>
          {isPreviewMode || mode === 'result' || mode === 'history' ? (
            <div className={mode === 'result' || mode === 'history' ? "prose" : "markdown"}>
              {stepMarkdown}
            </div>
          ) : (
            <div>
              <textarea
                placeholder="手順"
                value={step.step}
                onChange={(e) => onStepChange?.('step', e.target.value)}
                className="w-full p-1 border rounded h-[6em]"
              />
            </div>
          )}
        </div>
      </td>

      {/* 期待値列 */}
      <td className={`border border-gray-300 ${mode === 'history' ? 'px-4 py-2' : 'px-2 py-1'}`}>
        <div className={mode === 'history' ? 'prose' : 'relative'}>
          {isPreviewMode || mode === 'result' || mode === 'history' ? (
            <div className={mode === 'result' || mode === 'history' ? "prose" : "markdown"}>
              {expectedMarkdown}
            </div>
          ) : (
            <div>
              <textarea
                placeholder="期待値"
                value={step.expected}
                onChange={(e) => onStepChange?.('expected', e.target.value)}
                className="w-full p-1 border rounded h-[6em]"
              />
            </div>
          )}
        </div>
      </td>

      {/* 判定列（結果モードまたは履歴モード） */}
      {(mode === 'result' || mode === 'history') && (
        <td className={`border border-gray-300 ${mode === 'history' ? 'px-4 py-2' : 'px-2 py-1'}`}>
          {mode === 'result' ? (
            <div className="flex flex-col space-y-2">
              <div className="flex space-x-2">
                <button
                  className={`px-2 py-1 ${
                    step.result === "OK"
                      ? "bg-green-500"
                      : "bg-gray-400"
                  } text-white rounded`}
                  onClick={() => onResultChange?.("OK")}
                >
                  OK
                </button>
                <button
                  className={`px-2 py-1 ${
                    step.result === "NG"
                      ? "bg-red-500"
                      : "bg-gray-400"
                  } text-white rounded`}
                  onClick={() => onResultChange?.("NG")}
                >
                  NG
                </button>
                <button
                  className={`px-2 py-1 ${
                    step.result === "N/A"
                      ? "bg-yellow-500"
                      : "bg-gray-400"
                  } text-white rounded`}
                  onClick={() => onResultChange?.("N/A")}
                >
                  N/A
                </button>
              </div>
              <div className="space-y-2">
                {isPreviewMode ? (
                  <div className="prose p-2 min-h-[100px]">
                    {commentMarkdown}
                  </div>
                ) : (
                  <textarea
                    placeholder="コメント"
                    className="px-2 py-1 border rounded w-[40ch] h-[6em] font-mono"
                    value={comment}
                    onChange={(e) => onCommentChange?.(e.target.value)}
                  />
                )}
              </div>
            </div>
          ) : (
            // 履歴モード - 結果を表示のみ
            <span
              className={`px-2 py-1 rounded text-white ${
                historyResult === "OK"
                  ? "bg-green-500"
                  : historyResult === "NG"
                  ? "bg-red-500"
                  : "bg-yellow-500"
              }`}
            >
              {historyResult}
            </span>
          )}
        </td>
      )}

      {/* コメント列（履歴モードのみ） */}
      {mode === 'history' && (
        <td className="border border-gray-300 px-4 py-2">
          <div className="prose">
            {historyCommentMarkdown}
          </div>
        </td>
      )}
    </tr>
  );
}

export default Step;