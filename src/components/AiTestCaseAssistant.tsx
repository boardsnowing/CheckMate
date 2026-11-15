import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PreconditionDetails, TestCase } from "../types/TestCase";
import { t } from "../i18n";

type Provider = "opencode" | "openai" | "claude" | "gemini" | "deepseek";

interface AiTestCaseAssistantProps {
  isOpen: boolean;
  suiteName: string;
  preconditionDetails: PreconditionDetails;
  testCases: TestCase[];
  onClose: () => void;
  onApply: (testCases: TestCase[]) => void;
  onOpenApiKeySettings: () => Promise<void>;
}

const providers: { value: Provider; label: string }[] = [
  { value: "opencode", label: "OpenCode (OpenAI互換)" },
  { value: "openai", label: "OpenAI" },
  { value: "claude", label: "Claude" },
  { value: "gemini", label: "Gemini" },
  { value: "deepseek", label: "DeepSeek" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createTestCasesFromDraft(
  draft: string,
  currentCases: TestCase[],
): TestCase[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(draft);
  } catch {
    throw new Error(t("JSONの形式を確認してください"));
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.test_cases)) {
    throw new Error(t("test_cases配列を含むJSONを入力してください"));
  }
  if (parsed.test_cases.length === 0) {
    throw new Error(t("テストケースを1件以上含めてください"));
  }

  const currentById = new Map(currentCases.map((testCase) => [testCase.id, testCase]));
  const usedIds = new Set<string>();
  const maxId = currentCases.reduce((max, testCase) => {
    const match = /^tc-(\d+)$/.exec(testCase.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  let nextId = maxId + 1;

  return parsed.test_cases.map((value, index) => {
    if (!isRecord(value)) {
      throw new Error(t("{{index}}件目のテストケースの形式が正しくありません", {
        index: index + 1,
      }));
    }

    if (typeof value.name !== "string" || !value.name.trim() || !Array.isArray(value.steps)) {
      throw new Error(t("{{index}}件目のテストケースに名前または手順がありません", {
        index: index + 1,
      }));
    }

    const steps = value.steps.map((step, stepIndex) => {
      if (
        !isRecord(step) ||
        typeof step.step !== "string" ||
        typeof step.expected !== "string"
      ) {
        throw new Error(t("{{caseIndex}}件目の{{stepIndex}}件目の手順の形式が正しくありません", {
          caseIndex: index + 1,
          stepIndex: stepIndex + 1,
        }));
      }
      return { step: step.step, expected: step.expected };
    });
    if (steps.length === 0) {
      throw new Error(t("{{index}}件目のテストケースに手順を1件以上含めてください", {
        index: index + 1,
      }));
    }

    const requestedId = value.id;
    if (requestedId !== undefined && typeof requestedId !== "string") {
      throw new Error(t("テストケースIDは文字列で指定してください"));
    }

    let id = typeof requestedId === "string" ? requestedId : "";
    if (!id || !currentById.has(id)) {
      while (usedIds.has(`tc-${nextId}`) || currentById.has(`tc-${nextId}`)) {
        nextId += 1;
      }
      id = `tc-${nextId}`;
      nextId += 1;
    }
    if (usedIds.has(id)) {
      throw new Error(t("テストケースIDが重複しています: {{id}}", { id }));
    }
    usedIds.add(id);

    const current = currentById.get(id);
    const unchanged =
      current !== undefined &&
      current.name === value.name &&
      current.steps.length === steps.length &&
      current.steps.every(
        (step, stepIndex) =>
          step.step === steps[stepIndex].step &&
          step.expected === steps[stepIndex].expected,
      );

    if (unchanged && current) return current;
    return { id, name: value.name, steps };
  });
}

export default function AiTestCaseAssistant({
  isOpen,
  suiteName,
  preconditionDetails,
  testCases,
  onClose,
  onApply,
  onOpenApiKeySettings,
}: AiTestCaseAssistantProps) {
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [instruction, setInstruction] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [draftJson, setDraftJson] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);

  if (!isOpen) return null;

  const close = () => {
    setModel("");
    setEndpoint("");
    setInstruction("");
    setIsConfirmed(false);
    setError("");
    setDraftJson("");
    setIsReviewing(false);
    onClose();
  };

  const generate = async () => {
    if (!model.trim() || !instruction.trim() || !isConfirmed) {
      setError(t("必須項目とデータ送信の確認を入力してください"));
      return;
    }
    if (provider === "opencode" && !endpoint.trim()) {
      setError(t("OpenCode互換APIのエンドポイントURLを入力してください"));
      return;
    }

    setIsSending(true);
    setError("");
    try {
      const suiteContext = {
        name: suiteName,
        preconditions: preconditionDetails,
        test_cases: testCases.map(({ id, name, steps }) => ({
          id,
          name,
          steps: steps.map(({ step, expected }) => ({ step, expected })),
        })),
      };
      const generated = await invoke<string>("generate_test_case_suggestions", {
        request: {
          provider,
          model: model.trim(),
          endpoint: endpoint.trim() || null,
          instruction: instruction.trim(),
          suiteContext,
        },
      });
      setDraftJson(generated);
      setIsReviewing(true);
    } catch (requestError) {
      setError(t("AI生成に失敗しました: {{error}}", {
        error: String(requestError),
      }));
    } finally {
      setIsSending(false);
    }
  };

  const applyDraft = () => {
    try {
      onApply(createTestCasesFromDraft(draftJson, testCases));
      close();
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : String(draftError));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-test-case-title"
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="ai-test-case-title" className="text-xl font-bold">
              {t("AIでテストケースを作成")}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {t("テストスイート「{{name}}」をもとに生成します", { name: suiteName })}
            </p>
          </div>
          <button
            type="button"
            className="rounded px-2 py-1 text-gray-600 hover:bg-gray-100"
            onClick={close}
            disabled={isSending}
            aria-label={t("閉じる")}
          >
            ×
          </button>
        </div>

        {isReviewing ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              {t("生成結果を確認・編集してください。適用するまでテストスイートは変更されません。")}
            </p>
            <label className="block text-sm font-medium">
              {t("生成されたテストケース（JSON）")}
              <textarea
                className="mt-1 h-80 w-full rounded border border-gray-300 p-3 font-mono text-sm"
                value={draftJson}
                onChange={(event) => {
                  setDraftJson(event.target.value);
                  setError("");
                }}
                spellCheck={false}
              />
            </label>
            <div className="rounded bg-amber-50 p-3 text-sm text-amber-900">
              {t("適用すると既存のテストケース一覧全体が置き換わります。変更されたケースの実行状態はクリアされます。")}
            </div>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded bg-gray-200 px-4 py-2 hover:bg-gray-300"
                onClick={() => {
                  setIsReviewing(false);
                  setError("");
                }}
              >
                {t("設定に戻る")}
              </button>
              <button
                type="button"
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                onClick={applyDraft}
              >
                {t("確認した内容を適用")}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm font-medium">
              {t("AIプロバイダー")}
              <select
                className="mt-1 w-full rounded border border-gray-300 p-2"
                value={provider}
                onChange={(event) => {
                  const selectedProvider = providers.find(
                    (item) => item.value === event.target.value,
                  );
                  if (selectedProvider) setProvider(selectedProvider.value);
                  setEndpoint("");
                  setError("");
                }}
              >
                {providers.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.value === "opencode" ? t("OpenCode (OpenAI互換)") : item.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center justify-between gap-3 rounded bg-gray-50 p-3 text-sm">
              <span>{t("APIキー設定画面で保存済みのキーを使用します")}</span>
              <button
                type="button"
                className="shrink-0 rounded border border-blue-500 px-3 py-1 text-blue-600 hover:bg-blue-50"
                onClick={async () => {
                  close();
                  await onOpenApiKeySettings();
                }}
              >
                {t("APIキー設定")}
              </button>
            </div>

            <label className="block text-sm font-medium">
              {t("モデルID")}
              <input
                type="text"
                autoComplete="off"
                className="mt-1 w-full rounded border border-gray-300 p-2"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder={t("例: 使用するモデルのID")}
              />
            </label>

            <label className="block text-sm font-medium">
              {t("APIエンドポイントURL（必要な場合）")}
              <input
                type="url"
                autoComplete="off"
                className="mt-1 w-full rounded border border-gray-300 p-2"
                value={endpoint}
                onChange={(event) => setEndpoint(event.target.value)}
                placeholder={
                  provider === "opencode"
                    ? "https://api.example.com/v1/chat/completions"
                    : t("空欄の場合はプロバイダーの既定URLを使用")
                }
              />
            </label>

            <label className="block text-sm font-medium">
              {t("生成・編集の指示")}
              <textarea
                className="mt-1 h-28 w-full rounded border border-gray-300 p-2"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder={t("追加・変更したいテストケースを具体的に記述してください")}
              />
            </label>

            <label className="flex items-start gap-2 rounded bg-amber-50 p-3 text-sm text-amber-900">
              <input
                type="checkbox"
                className="mt-1"
                checked={isConfirmed}
                onChange={(event) => setIsConfirmed(event.target.checked)}
              />
              <span>
                {t("テストスイート名、前提条件、既存テストケース全件、および指示文を選択したAIプロバイダーへ送信することを理解しました。")}
              </span>
            </label>
            <p className="text-xs text-gray-600">
              {t("APIキーはconfig.jsonに平文保存され、生成時に選択したプロバイダーへ送信されます。送信先のデータ利用・保持条件は各プロバイダーの規約を確認してください。")}
            </p>

            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded bg-gray-200 px-4 py-2 hover:bg-gray-300"
                onClick={close}
                disabled={isSending}
              >
                {t("キャンセル")}
              </button>
              <button
                type="button"
                className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={generate}
                disabled={isSending}
              >
                {isSending ? t("生成中...") : t("AIに生成を依頼")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
