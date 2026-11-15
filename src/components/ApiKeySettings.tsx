import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import { useLocation, useNavigate } from "react-router-dom";
import { t } from "../i18n";

type Provider = "opencode" | "openai" | "claude" | "gemini" | "deepseek";

const providers: { id: Provider; name: string }[] = [
  { id: "opencode", name: "OpenCode" },
  { id: "openai", name: "OpenAI" },
  { id: "claude", name: "Claude" },
  { id: "gemini", name: "Gemini" },
  { id: "deepseek", name: "DeepSeek" },
];

const emptyApiKeys: Record<Provider, string> = {
  opencode: "",
  openai: "",
  claude: "",
  gemini: "",
  deepseek: "",
};

const emptyStatuses: Record<Provider, boolean> = {
  opencode: false,
  openai: false,
  claude: false,
  gemini: false,
  deepseek: false,
};

function getReturnTo(state: unknown): string | null {
  if (
    typeof state === "object" &&
    state !== null &&
    "returnTo" in state &&
    typeof state.returnTo === "string" &&
    state.returnTo.startsWith("/")
  ) {
    return state.returnTo;
  }
  return null;
}

export default function ApiKeySettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const [apiKeys, setApiKeys] = useState(emptyApiKeys);
  const [configured, setConfigured] = useState(emptyStatuses);
  const [isLoading, setIsLoading] = useState(true);
  const [busyProvider, setBusyProvider] = useState<Provider | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const returnTo = getReturnTo(location.state);

  useEffect(() => {
    let active = true;
    invoke<Record<string, boolean>>("get_ai_api_key_status")
      .then((status) => {
        if (!active) return;
        setConfigured({
          opencode: status.opencode === true,
          openai: status.openai === true,
          claude: status.claude === true,
          gemini: status.gemini === true,
          deepseek: status.deepseek === true,
        });
      })
      .catch((error) => {
        if (active) {
          setFeedback({
            type: "error",
            message: t("APIキー設定の読み込みに失敗しました: {{error}}", {
              error: String(error),
            }),
          });
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const saveKey = async (provider: Provider) => {
    const apiKey = apiKeys[provider].trim();
    if (!apiKey) {
      setFeedback({ type: "error", message: t("APIキーを入力してください") });
      return;
    }

    setBusyProvider(provider);
    setFeedback(null);
    try {
      await invoke("save_ai_api_key", { provider, apiKey });
      setConfigured((previous) => ({ ...previous, [provider]: true }));
      setApiKeys((previous) => ({ ...previous, [provider]: "" }));
      setFeedback({
        type: "success",
        message: t("{{provider}}のAPIキーを保存しました", {
          provider: providers.find((item) => item.id === provider)?.name ?? provider,
        }),
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: t("APIキーの保存に失敗しました: {{error}}", {
          error: String(error),
        }),
      });
    } finally {
      setBusyProvider(null);
    }
  };

  const deleteKey = async (provider: Provider) => {
    const name = providers.find((item) => item.id === provider)?.name ?? provider;
    const accepted = await confirm(
      t("{{provider}}のAPIキーを削除しますか？", { provider: name }),
      { title: t("APIキーの削除") },
    );
    if (!accepted) return;

    setBusyProvider(provider);
    setFeedback(null);
    try {
      await invoke("delete_ai_api_key", { provider });
      setConfigured((previous) => ({ ...previous, [provider]: false }));
      setApiKeys((previous) => ({ ...previous, [provider]: "" }));
      setFeedback({
        type: "success",
        message: t("{{provider}}のAPIキーを削除しました", { provider: name }),
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: t("APIキーの削除に失敗しました: {{error}}", {
          error: String(error),
        }),
      });
    } finally {
      setBusyProvider(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          className="rounded bg-gray-200 px-3 py-1 hover:bg-gray-300"
          onClick={() => navigate(returnTo ?? "/")}
        >
          {t("戻る")}
        </button>
        <h1 className="text-xl font-bold">{t("AI APIキー設定")}</h1>
      </div>

      <div className="mb-5 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        {t("APIキーは実行ディレクトリのconfig.jsonに平文で保存されます。初回保存時に同じ場所の.gitignoreへ追加します。config.jsonは暗号化されません。")}
      </div>

      {feedback && (
        <p
          role={feedback.type === "error" ? "alert" : "status"}
          className={`mb-4 text-sm ${
            feedback.type === "error" ? "text-red-600" : "text-green-700"
          }`}
        >
          {feedback.message}
        </p>
      )}

      {isLoading ? (
        <p>{t("読み込み中...")}</p>
      ) : (
        <div className="space-y-4">
          {providers.map(({ id, name }) => (
            <section key={id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-semibold">{name}</h2>
                <span
                  className={`rounded px-2 py-1 text-xs ${
                    configured[id]
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {configured[id] ? t("設定済み") : t("未設定")}
                </span>
              </div>
              <label className="block text-sm">
                {t("APIキー")}
                <input
                  type="password"
                  autoComplete="new-password"
                  className="mt-1 w-full rounded border border-gray-300 p-2"
                  value={apiKeys[id]}
                  onChange={(event) => {
                    setApiKeys((previous) => ({
                      ...previous,
                      [id]: event.target.value,
                    }));
                    setFeedback(null);
                  }}
                  placeholder={
                    configured[id]
                      ? t("新しいキーを入力すると保存済みのキーを置き換えます")
                      : t("APIキーを入力")
                  }
                />
              </label>
              <div className="mt-3 flex justify-end gap-2">
                {configured[id] && (
                  <button
                    type="button"
                    className="rounded border border-red-500 px-3 py-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    onClick={() => deleteKey(id)}
                    disabled={busyProvider !== null}
                  >
                    {t("削除")}
                  </button>
                )}
                <button
                  type="button"
                  className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => saveKey(id)}
                  disabled={!apiKeys[id].trim() || busyProvider !== null}
                >
                  {busyProvider === id ? t("保存中...") : t("保存")}
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
