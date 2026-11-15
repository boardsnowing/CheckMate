use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::error::Error;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::Duration;

const AI_PROVIDERS: &[&str] = &["opencode", "openai", "claude", "gemini", "deepseek"];

const SYSTEM_PROMPT: &str =
    "あなたはテスト仕様書の作成を支援します。依頼内容と既存のテストスイート情報に基づき、\
テストケースを追加・編集してください。既存ケースを維持する場合はそのidを変更せず含め、\
新規ケースではidを省略してください。手順と期待値は具体的かつ検証可能にしてください。\
出力は説明やMarkdownコードブロックを付けず、次のJSON形式だけにしてください: \
{\"test_cases\":[{\"id\":\"既存ID（新規は省略）\",\"name\":\"ケース名\",\
\"steps\":[{\"step\":\"操作手順\",\"expected\":\"期待値\"}]}]}。\
既存の全ケースを含む完全な配列を返してください。";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiGenerationRequest {
    provider: String,
    model: String,
    endpoint: Option<String>,
    instruction: String,
    suite_context: Value,
}

#[derive(Default, Deserialize, Serialize)]
struct ApiKeyConfig {
    #[serde(default)]
    api_keys: HashMap<String, String>,
}

#[tauri::command]
pub fn get_ai_api_key_status() -> Result<HashMap<String, bool>, String> {
    let path = api_config_path()?;
    let config = load_api_key_config(&path)?;
    if path.exists() {
        ensure_config_ignored(&path)?;
    }

    Ok(AI_PROVIDERS
        .iter()
        .map(|provider| {
            (
                (*provider).to_string(),
                config
                    .api_keys
                    .get(*provider)
                    .map(|key| !key.trim().is_empty())
                    .unwrap_or(false),
            )
        })
        .collect())
}

#[tauri::command]
pub fn save_ai_api_key(provider: String, api_key: String) -> Result<(), String> {
    validate_provider(&provider)?;
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err("APIキーを入力してください".to_string());
    }

    let path = api_config_path()?;
    let mut config = load_api_key_config(&path)?;
    config.api_keys.insert(provider, api_key.to_string());
    save_api_key_config(&path, &config)
}

#[tauri::command]
pub fn delete_ai_api_key(provider: String) -> Result<(), String> {
    validate_provider(&provider)?;
    let path = api_config_path()?;
    let mut config = load_api_key_config(&path)?;
    if config.api_keys.remove(&provider).is_none() {
        return Ok(());
    }

    if config.api_keys.is_empty() {
        fs::remove_file(&path)
            .map_err(|error| format!("APIキー設定ファイルを削除できません: {}", error))?;
        Ok(())
    } else {
        save_api_key_config(&path, &config)
    }
}

#[tauri::command]
pub async fn generate_test_case_suggestions(
    request: AiGenerationRequest,
) -> Result<String, String> {
    validate_provider(&request.provider)?;
    let api_key = load_api_key(&request.provider)?;
    let model = request.model.trim();
    let instruction = request.instruction.trim();
    if model.is_empty() || instruction.is_empty() {
        return Err("モデルIDと依頼内容を入力してください".to_string());
    }

    let endpoint = resolve_endpoint(&request.provider, request.endpoint.as_deref(), model)?;
    let user_content = format!(
        "依頼内容:\n{}\n\n現在のテストスイート情報:\n{}",
        instruction,
        serde_json::to_string_pretty(&request.suite_context)
            .map_err(|error| format!("テストスイート情報をJSONに変換できません: {}", error))?
    );

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|error| format!("AI APIクライアントを初期化できません: {}", error))?;

    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    let body = match request.provider.as_str() {
        "openai" => {
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&format!("Bearer {}", api_key))
                    .map_err(|error| format!("APIキーをHTTPヘッダーに設定できません: {}", error))?,
            );
            json!({
                "model": model,
                "messages": [
                    { "role": "system", "content": SYSTEM_PROMPT },
                    { "role": "user", "content": user_content }
                ],
                "max_completion_tokens": 8192
            })
        }
        "deepseek" | "opencode" => {
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&format!("Bearer {}", api_key))
                    .map_err(|error| format!("APIキーをHTTPヘッダーに設定できません: {}", error))?,
            );
            json!({
                "model": model,
                "messages": [
                    { "role": "system", "content": SYSTEM_PROMPT },
                    { "role": "user", "content": user_content }
                ],
                "max_tokens": 8192
            })
        }
        "claude" => {
            headers.insert(
                "x-api-key",
                HeaderValue::from_str(api_key.as_str())
                    .map_err(|error| format!("APIキーをHTTPヘッダーに設定できません: {}", error))?,
            );
            headers.insert("anthropic-version", HeaderValue::from_static("2023-06-01"));
            json!({
                "model": model,
                "max_tokens": 8192,
                "system": SYSTEM_PROMPT,
                "messages": [{ "role": "user", "content": user_content }]
            })
        }
        "gemini" => {
            headers.insert(
                "x-goog-api-key",
                HeaderValue::from_str(api_key.as_str())
                    .map_err(|error| format!("APIキーをHTTPヘッダーに設定できません: {}", error))?,
            );
            json!({
                "systemInstruction": { "parts": [{ "text": SYSTEM_PROMPT }] },
                "contents": [{ "role": "user", "parts": [{ "text": user_content }] }],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "maxOutputTokens": 8192
                }
            })
        }
        _ => return Err("サポートされていないAIプロバイダーです".to_string()),
    };

    let response = client
        .post(endpoint)
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|error| {
            format!(
                "AI APIへの接続に失敗しました: {}",
                request_error_message(&error)
            )
        })?;

    let status = response.status();
    let response_body = response.text().await.map_err(|error| {
        format!(
            "AI APIの応答を読み取れません: {}",
            request_error_message(&error)
        )
    })?;
    if !status.is_success() {
        return Err(format!(
            "AI APIがHTTP {}を返しました: {}",
            status.as_u16(),
            truncate(&response_body, 1000)
        ));
    }

    let response_json: Value = serde_json::from_str(&response_body)
        .map_err(|error| format!("AI APIの応答をJSONとして解析できません: {}", error))?;
    extract_generated_text(&request.provider, &response_json)
}

fn resolve_endpoint(provider: &str, endpoint: Option<&str>, model: &str) -> Result<String, String> {
    if let Some(endpoint) = endpoint.map(str::trim).filter(|value| !value.is_empty()) {
        return Ok(endpoint.replace("{model}", model));
    }

    match provider {
        "openai" => Ok("https://api.openai.com/v1/chat/completions".to_string()),
        "claude" => Ok("https://api.anthropic.com/v1/messages".to_string()),
        "gemini" => Ok(format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
            model
        )),
        "deepseek" => Ok("https://api.deepseek.com/v1/chat/completions".to_string()),
        "opencode" => Err("OpenCode互換APIのエンドポイントURLを入力してください".to_string()),
        _ => Err("サポートされていないAIプロバイダーです".to_string()),
    }
}

fn validate_provider(provider: &str) -> Result<(), String> {
    if AI_PROVIDERS.contains(&provider) {
        Ok(())
    } else {
        Err("サポートされていないAIプロバイダーです".to_string())
    }
}

fn api_config_path() -> Result<PathBuf, String> {
    std::env::current_dir()
        .map(|directory| directory.join("config.json"))
        .map_err(|error| format!("設定ディレクトリを取得できません: {}", error))
}

fn load_api_key_config(path: &Path) -> Result<ApiKeyConfig, String> {
    match fs::read_to_string(path) {
        Ok(content) => serde_json::from_str(&content)
            .map_err(|error| format!("APIキー設定を解析できません: {}", error)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(ApiKeyConfig::default()),
        Err(error) => Err(format!("APIキー設定を読み込めません: {}", error)),
    }
}

fn load_api_key(provider: &str) -> Result<String, String> {
    let path = api_config_path()?;
    let config = load_api_key_config(&path)?;
    config
        .api_keys
        .get(provider)
        .map(|key| key.trim())
        .filter(|key| !key.is_empty())
        .map(str::to_string)
        .ok_or_else(|| {
            format!(
                "{}のAPIキーが未設定です。APIキー設定画面で保存してください",
                provider
            )
        })
}

fn save_api_key_config(path: &Path, config: &ApiKeyConfig) -> Result<(), String> {
    ensure_config_ignored(path)?;
    let json = serde_json::to_string_pretty(config)
        .map_err(|error| format!("APIキー設定をJSONに変換できません: {}", error))?;
    fs::write(path, json).map_err(|error| format!("APIキー設定を保存できません: {}", error))
}

fn ensure_config_ignored(config_path: &Path) -> Result<(), String> {
    let parent = config_path.parent().unwrap_or_else(|| Path::new("."));
    let ignore_path = parent.join(".gitignore");
    let file_name = config_path
        .file_name()
        .ok_or_else(|| "設定ファイル名を取得できません".to_string())?
        .to_string_lossy();
    let rule = file_name.as_ref();

    let contents = match fs::read_to_string(&ignore_path) {
        Ok(contents) => contents,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(error) => return Err(format!(".gitignoreを読み込めません: {}", error)),
    };
    if contents.lines().any(|line| {
        let line = line.trim();
        line == rule || line == format!("/{}", rule)
    }) {
        return Ok(());
    }

    let mut addition = String::new();
    if !contents.is_empty() && !contents.ends_with('\n') {
        addition.push('\n');
    }
    if !contents.trim().is_empty() {
        addition.push('\n');
    }
    addition.push_str("# Local API credentials\n");
    addition.push_str(rule);
    addition.push('\n');

    let mut ignore_file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&ignore_path)
        .map_err(|error| format!(".gitignoreを作成できません: {}", error))?;
    ignore_file
        .write_all(addition.as_bytes())
        .map_err(|error| format!(".gitignoreを更新できません: {}", error))
}

fn extract_generated_text(provider: &str, response: &Value) -> Result<String, String> {
    let text = match provider {
        "openai" | "deepseek" | "opencode" => response
            .get("choices")
            .and_then(Value::as_array)
            .and_then(|choices| choices.first())
            .and_then(|choice| choice.get("message"))
            .and_then(|message| message.get("content"))
            .and_then(extract_text_value),
        "claude" => response.get("content").and_then(extract_text_value),
        "gemini" => response
            .get("candidates")
            .and_then(Value::as_array)
            .and_then(|candidates| candidates.first())
            .and_then(|candidate| candidate.get("content"))
            .and_then(|content| content.get("parts"))
            .and_then(extract_text_value),
        _ => return Err("サポートされていないAIプロバイダーです".to_string()),
    };

    text.filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "AI APIの応答に生成テキストがありません".to_string())
}

fn extract_text_value(value: &Value) -> Option<String> {
    if let Some(text) = value.as_str() {
        return Some(text.to_string());
    }

    value.as_array().map(|parts| {
        parts
            .iter()
            .filter_map(|part| part.get("text").and_then(Value::as_str))
            .collect::<Vec<_>>()
            .join("")
    })
}

fn truncate(value: &str, max_chars: usize) -> String {
    let mut chars = value.chars();
    let prefix = chars.by_ref().take(max_chars).collect::<String>();
    if chars.next().is_some() {
        format!("{}…", prefix)
    } else {
        prefix
    }
}

fn error_chain(error: &dyn Error) -> String {
    let mut messages = vec![error.to_string()];
    let mut source = error.source();
    while let Some(cause) = source {
        messages.push(cause.to_string());
        source = cause.source();
    }
    messages.join(": ")
}

fn request_error_message(error: &reqwest::Error) -> String {
    let detail = error_chain(error);
    if error.is_timeout() {
        if error.is_connect() {
            format!("接続が20秒以内に確立できませんでした ({})", detail)
        } else {
            format!("AI APIが300秒以内に応答しませんでした ({})", detail)
        }
    } else {
        detail
    }
}

#[cfg(test)]
mod tests {
    use super::{
        ensure_config_ignored, extract_generated_text, load_api_key_config, save_api_key_config,
        ApiKeyConfig,
    };
    use serde_json::json;
    use std::collections::HashMap;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_directory() -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "checkmate-api-key-test-{}-{}",
            std::process::id(),
            timestamp
        ));
        fs::create_dir(&path).unwrap();
        path
    }

    #[test]
    fn creates_gitignore_for_new_config() {
        let directory = test_directory();
        let config_path = directory.join("config.json");

        ensure_config_ignored(&config_path).unwrap();

        let contents = fs::read_to_string(directory.join(".gitignore")).unwrap();
        assert!(contents.lines().any(|line| line == "config.json"));
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn preserves_existing_gitignore_rules_and_avoids_duplicates() {
        let directory = test_directory();
        let config_path = directory.join("config.json");
        let ignore_path = directory.join(".gitignore");
        fs::write(&ignore_path, "conf.json\n").unwrap();

        ensure_config_ignored(&config_path).unwrap();
        ensure_config_ignored(&config_path).unwrap();

        let contents = fs::read_to_string(&ignore_path).unwrap();
        assert!(contents.lines().any(|line| line == "conf.json"));
        assert_eq!(
            contents
                .lines()
                .filter(|line| *line == "config.json")
                .count(),
            1
        );
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn saves_api_keys_without_losing_other_provider_settings() {
        let directory = test_directory();
        let config_path = directory.join("config.json");
        let config = ApiKeyConfig {
            api_keys: HashMap::from([
                ("gemini".to_string(), "example-gemini-key".to_string()),
                ("openai".to_string(), "example-openai-key".to_string()),
            ]),
        };

        save_api_key_config(&config_path, &config).unwrap();
        let loaded = load_api_key_config(&config_path).unwrap();

        assert_eq!(
            loaded.api_keys.get("gemini").map(String::as_str),
            Some("example-gemini-key")
        );
        assert_eq!(
            loaded.api_keys.get("openai").map(String::as_str),
            Some("example-openai-key")
        );
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn extracts_openai_compatible_content() {
        let response = json!({
            "choices": [{ "message": { "content": "{\"test_cases\":[]}" } }]
        });
        assert_eq!(
            extract_generated_text("openai", &response).unwrap(),
            "{\"test_cases\":[]}"
        );
    }

    #[test]
    fn extracts_claude_text_blocks() {
        let response = json!({
            "content": [
                { "type": "text", "text": "{\"test_cases\":" },
                { "type": "text", "text": "[]}" }
            ]
        });
        assert_eq!(
            extract_generated_text("claude", &response).unwrap(),
            "{\"test_cases\":[]}"
        );
    }

    #[test]
    fn extracts_gemini_text_parts() {
        let response = json!({
            "candidates": [{
                "content": { "parts": [{ "text": "{\"test_cases\":[]}" }] }
            }]
        });
        assert_eq!(
            extract_generated_text("gemini", &response).unwrap(),
            "{\"test_cases\":[]}"
        );
    }

    #[test]
    fn rejects_empty_provider_responses() {
        assert!(extract_generated_text("openai", &json!({ "choices": [] })).is_err());
    }
}
