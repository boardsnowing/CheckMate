use chrono::Utc;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::fs;
use std::fs::read_dir;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::command;

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Config {
    user_name: String,
}

static CONFIG: Lazy<Mutex<Option<Config>>> = Lazy::new(|| Mutex::new(None));

fn load_config() -> Result<Config, String> {
    let config_path = PathBuf::from("conf.json");
    let config_content = fs::read_to_string(&config_path)
        .map_err(|e| format!("設定ファイルの読み込みに失敗しました: {}", e))?;

    let config: Config = serde_json::from_str(&config_content)
        .map_err(|e| format!("設定ファイルのパースに失敗しました: {}", e))?;

    Ok(config)
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TestSuite {
    id: String,
    name: String,
    test_case_id: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct TestCase {
    id: String,
    name: String,
    steps: Vec<TestStep>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct TestStep {
    step: String,
    expected: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct TestResult {
    test_suite_id: String,
    test_run_name: String,
    executed_by: String,
    executed_at: String,
    test_results: Vec<TestCaseResult>,
}

#[derive(Serialize, Deserialize, Debug)]
struct TestCaseResult {
    test_case_id: String,
    results: Vec<TestStepResult>,
}

#[derive(Serialize, Deserialize, Debug)]
struct TestStepResult {
    step: String,
    expected: String,
    status: String,
    comment: String,
}

#[command]
fn save_test_result(
    test_suite_id: String,
    _test_suite_name: String,
    _executed_by: String, // 引数は残すが使用しない
    test_results: Vec<TestCaseResult>,
    file_name: String,
) -> Result<(), String> {
    let config = CONFIG.lock().unwrap();
    let executed_by = if let Some(config) = config.as_ref() {
        config.user_name.clone()
    } else {
        return Err("設定が読み込まれていません".to_string());
    };
    let now = Utc::now();
    let timestamp = now.format("%Y-%m-%dT%H:%M:%SZ").to_string();

    let test_result = TestResult {
        test_suite_id: test_suite_id.clone(),
        test_run_name: file_name.clone(),
        executed_by,
        executed_at: timestamp,
        test_results,
    };

    let dir_path = PathBuf::from("test_results").join(&test_suite_id);
    fs::create_dir_all(&dir_path).map_err(|e| format!("Failed to create directory: {}", e))?;

    let file_path = dir_path.join(&file_name);

    // ファイルが既に存在する場合はエラーを返す
    if file_path.exists() {
        return Err("指定されたファイル名は既に存在します。別の名前を指定してください。".to_string());
    }

    let json = serde_json::to_string_pretty(&test_result)
        .map_err(|e| format!("Failed to serialize test result: {}", e))?;
    fs::write(&file_path, json).map_err(|e| format!("Failed to write file: {}", e))?;

    println!("Successfully saved test result to: {}", file_path.display());
    Ok(())
}

#[command]
fn save_test_cases(suite_id: String, test_cases: Vec<TestCase>) -> Result<(), String> {
    let file_path = std::path::PathBuf::from("test_data").join(format!("{}.json", suite_id));
    fs::create_dir_all("test_data").map_err(|e| format!("Failed to create directory: {}", e))?;

    let json = serde_json::to_string_pretty(&test_cases)
        .map_err(|e| format!("Failed to serialize test cases: {}", e))?;
    fs::write(&file_path, json).map_err(|e| format!("Failed to write file: {}", e))?;

    println!("Successfully saved test cases to: {}", file_path.display());
    Ok(())
}

#[command]
fn get_test_cases(suite_id: String) -> Result<Vec<TestCase>, String> {
    let file_path = std::path::PathBuf::from("test_data").join(format!("{}.json", suite_id));

    if !file_path.exists() {
        println!(
            "File not found: {}. Creating new test case file.",
            file_path.display()
        );
        return Ok(Vec::new());
    }

    let file_content =
        fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    // BOMを除去してからJSONをパース
    let content = file_content.trim_start_matches('\u{feff}');
    let test_cases: Vec<TestCase> =
        serde_json::from_str(content).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    println!(
        "Successfully loaded test cases from: {}",
        file_path.display()
    );
    Ok(test_cases)
}

#[command]
fn get_test_suites() -> Result<Vec<TestSuite>, String> {
    let dir_path = PathBuf::from("test_data");
    if !dir_path.exists() {
        fs::create_dir_all(&dir_path).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let mut test_suites = Vec::new();
    for entry in read_dir(dir_path).map_err(|e| format!("Failed to read directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        if path.is_file() && path.extension().map_or(false, |ext| ext == "json") {
            if let Some(file_stem) = path.file_stem() {
                if let Some(id) = file_stem.to_str() {
                    // ファイルからテストケースを読み込んで最初のケースの名前を取得
                    let file_path = path.clone();
                    let file_content = fs::read_to_string(&file_path)
                        .map_err(|e| format!("Failed to read file: {}", e))?;
                    let content = file_content.trim_start_matches('\u{feff}');
                    let test_cases: Vec<TestCase> = serde_json::from_str(content)
                        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

                    // 最初のテストケースのIDを取得
                    let first_test_case_id = test_cases.first().map(|tc| tc.id.clone());

                    test_suites.push(TestSuite {
                        id: id.to_string(),
                        name: id.to_string(),
                        test_case_id: first_test_case_id,
                    });
                }
            }
        }
    }

    Ok(test_suites)
}

#[command]
fn delete_test_suite(id: String) -> Result<(), String> {
    // テストデータファイルの削除
    let data_file_path = PathBuf::from("test_data").join(format!("{}.json", id));
    if data_file_path.exists() {
        fs::remove_file(&data_file_path)
            .map_err(|e| format!("Failed to delete test data file: {}", e))?;
    }

    // テスト結果ディレクトリの削除
    let results_dir_path = PathBuf::from("test_results").join(&id);
    if results_dir_path.exists() {
        fs::remove_dir_all(&results_dir_path)
            .map_err(|e| format!("Failed to delete test results directory: {}", e))?;
    }

    Ok(())
}

#[command]
fn rename_test_suite(id: String, new_name: String, _test_case_id: Option<String>) -> Result<(), String> {
    let dir_path = PathBuf::from("test_data");
    let file_path = dir_path.join(format!("{}.json", id));

    if !file_path.exists() {
        return Err("Test suite not found".to_string());
    }

    // テストケースを読み込む
    let file_content =
        fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;
    let content = file_content.trim_start_matches('\u{feff}');
    let test_cases: Vec<TestCase> =
        serde_json::from_str(content).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    // テストケースを保存（テストスイート名の変更はフロントエンド側で管理）
    let json = serde_json::to_string_pretty(&test_cases)
        .map_err(|e| format!("Failed to serialize test cases: {}", e))?;
    fs::write(&file_path, json).map_err(|e| format!("Failed to write file: {}", e))?;

    // test_resultsディレクトリ内のテストスイート名のディレクトリ名も変更
    let old_results_dir = PathBuf::from("test_results").join(&id);
    let new_results_dir = PathBuf::from("test_results").join(&new_name);

    if old_results_dir.exists() {
        fs::rename(&old_results_dir, &new_results_dir)
            .map_err(|e| format!("Failed to rename results directory: {}", e))?;
    }

    // テストデータファイルの名前も変更
    let new_file_path = dir_path.join(format!("{}.json", new_name));
    fs::rename(&file_path, &new_file_path)
        .map_err(|e| format!("Failed to rename test data file: {}", e))?;

    Ok(())
}

#[command]
fn get_user_name() -> Result<String, String> {
    let config = CONFIG.lock().unwrap();
    if let Some(config) = config.as_ref() {
        Ok(config.user_name.clone())
    } else {
        Err("設定が読み込まれていません".to_string())
    }
}

#[command]
fn delete_test_result(test_suite_id: String, file_name: String) -> Result<(), String> {
    let file_path = PathBuf::from("test_results")
        .join(&test_suite_id)
        .join(&file_name);

    if !file_path.exists() {
        return Err("指定されたテスト結果が見つかりません。".to_string());
    }

    fs::remove_file(&file_path)
        .map_err(|e| format!("テスト結果の削除に失敗しました: {}", e))?;

    Ok(())
}

#[command]
fn get_test_results(test_suite_id: String) -> Result<Vec<TestResult>, String> {
    let dir_path = PathBuf::from("test_results").join(&test_suite_id);
    
    if !dir_path.exists() {
        return Ok(Vec::new());
    }

    let mut results = Vec::new();
    for entry in read_dir(&dir_path).map_err(|e| format!("Failed to read directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        
        if path.is_file() && path.extension().map_or(false, |ext| ext == "json") {
            let file_content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read file: {}", e))?;
            let content = file_content.trim_start_matches('\u{feff}');
            let result: TestResult = serde_json::from_str(content)
                .map_err(|e| format!("Failed to parse JSON: {}", e))?;
            results.push(result);
        }
    }

    Ok(results)
}

#[command]
fn update_user_name(new_name: String) -> Result<(), String> {
    let config = Config {
        user_name: new_name,
    };
    
    let config_path = PathBuf::from("conf.json");
    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("設定のシリアライズに失敗しました: {}", e))?;
    
    fs::write(&config_path, json)
        .map_err(|e| format!("設定ファイルの書き込みに失敗しました: {}", e))?;
    
    *CONFIG.lock().unwrap() = Some(config);
    Ok(())
}

#[command]
fn create_test_suite(name: String, test_case_id: Option<String>) -> Result<TestSuite, String> {
    let dir_path = PathBuf::from("test_data");
    fs::create_dir_all(&dir_path).map_err(|e| format!("Failed to create directory: {}", e))?;

    let file_path = dir_path.join(format!("{}.json", name));

    // 空のテストケース配列を作成
    let empty_test_cases: Vec<TestCase> = Vec::new();
    let json = serde_json::to_string_pretty(&empty_test_cases)
        .map_err(|e| format!("Failed to serialize test cases: {}", e))?;
    fs::write(&file_path, json).map_err(|e| format!("Failed to write file: {}", e))?;

    let test_suite = TestSuite {
        id: name.clone(),
        name,
        test_case_id,
    };

    Ok(test_suite)
}

fn main() {
    // 設定ファイルを読み込む
    if let Ok(config) = load_config() {
        *CONFIG.lock().unwrap() = Some(config);
    } else {
        eprintln!("警告: 設定ファイルの読み込みに失敗しました");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            get_test_cases,
            save_test_cases,
            save_test_result,
            get_test_suites,
            create_test_suite,
            rename_test_suite,
            delete_test_suite,
            get_user_name,
            update_user_name,
            get_test_results,
            delete_test_result
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
