use chrono::Utc;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::fs;
use std::fs::read_dir;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{command, AppHandle};

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

#[derive(Serialize, Deserialize, Debug, Clone)]
struct TestTemplate {
    id: String,
    name: String,
    description: String,
    steps: Vec<TestStep>,
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

#[derive(Serialize, Deserialize, Debug, Clone)]
struct TestSuiteData {
    id: String,
    name: String,
    precondition: Option<String>,
    test_cases: Vec<TestCase>,
}

#[command]
fn get_test_templates() -> Result<Vec<TestTemplate>, String> {
    let dir_path = PathBuf::from("test_data/templates");
    if !dir_path.exists() {
        fs::create_dir_all(&dir_path).map_err(|e| format!("Failed to create directory: {}", e))?;
        return Ok(Vec::new());
    }

    let mut templates = Vec::new();
    for entry in read_dir(&dir_path).map_err(|e| format!("Failed to read directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        if path.is_file() && path.extension().map_or(false, |ext| ext == "json") {
            let file_content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read file: {}", e))?;
            let content = file_content.trim_start_matches('\u{feff}');
            let template: TestTemplate = serde_json::from_str(content)
                .map_err(|e| format!("Failed to parse JSON: {}", e))?;
            templates.push(template);
        }
    }

    Ok(templates)
}

#[command]
fn get_test_template(template_id: String) -> Result<TestTemplate, String> {
    let file_path = PathBuf::from("test_data/templates").join(format!("{}.json", template_id));
    
    if !file_path.exists() {
        return Err("テンプレートが見つかりません".to_string());
    }

    let file_content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    let content = file_content.trim_start_matches('\u{feff}');
    let template: TestTemplate = serde_json::from_str(content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    Ok(template)
}

#[command]
fn save_test_template(template: TestTemplate) -> Result<(), String> {
    let dir_path = PathBuf::from("test_data/templates");
    fs::create_dir_all(&dir_path).map_err(|e| format!("Failed to create directory: {}", e))?;

    let file_path = dir_path.join(format!("{}.json", template.id));
    let json = serde_json::to_string_pretty(&template)
        .map_err(|e| format!("Failed to serialize template data: {}", e))?;
    fs::write(&file_path, json).map_err(|e| format!("Failed to write file: {}", e))?;

    println!("Successfully saved template to: {}", file_path.display());
    Ok(())
}

#[command]
fn update_test_template(template: TestTemplate) -> Result<(), String> {
    let file_path = PathBuf::from("test_data/templates").join(format!("{}.json", template.id));
    
    if !file_path.exists() {
        return Err("テンプレートが見つかりません".to_string());
    }

    let json = serde_json::to_string_pretty(&template)
        .map_err(|e| format!("Failed to serialize template data: {}", e))?;
    fs::write(&file_path, json).map_err(|e| format!("Failed to write file: {}", e))?;

    println!("Successfully updated template: {}", file_path.display());
    Ok(())
}

#[command]
fn delete_test_template(template_id: String) -> Result<(), String> {
    let file_path = PathBuf::from("test_data/templates").join(format!("{}.json", template_id));
    
    if !file_path.exists() {
        return Err("テンプレートが見つかりません".to_string());
    }

    fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete template: {}", e))?;

    println!("Successfully deleted template: {}", file_path.display());
    Ok(())
}

#[command]
fn save_test_result(
    test_suite_id: String,
    _test_suite_name: String,
    _executed_by: String,
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
    let json = serde_json::to_string_pretty(&test_result)
        .map_err(|e| format!("Failed to serialize test result: {}", e))?;
    fs::write(&file_path, json).map_err(|e| format!("Failed to write file: {}", e))?;

    println!("Successfully saved test result to: {}", file_path.display());
    Ok(())
}

#[command]
fn save_test_suite(test_suite: TestSuiteData) -> Result<(), String> {
    let file_path = std::path::PathBuf::from("test_data").join(format!("{}.json", test_suite.id));
    fs::create_dir_all("test_data").map_err(|e| format!("Failed to create directory: {}", e))?;

    let json = serde_json::to_string_pretty(&test_suite)
        .map_err(|e| format!("Failed to serialize test suite data: {}", e))?;
    fs::write(&file_path, json).map_err(|e| format!("Failed to write file: {}", e))?;

    println!("Successfully saved test suite to: {}", file_path.display());
    Ok(())
}

#[command]
fn get_test_suites() -> Result<Vec<TestSuiteData>, String> {
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
                if let Some(_id) = file_stem.to_str() {
                    let file_path = path.clone();
                    let file_content = fs::read_to_string(&file_path)
                        .map_err(|e| format!("Failed to read file: {}", e))?;
                    let content = file_content.trim_start_matches('\u{feff}');
                    let data: TestSuiteData =
                    serde_json::from_str(content).map_err(|e| format!("Failed to parse JSON: {}", e))?;

                    test_suites.push(data);
                }
            }
        }
    }

    Ok(test_suites)
}

#[command]
fn get_test_suite(id: String) -> Result<TestSuiteData, String> {
    let file_path = std::path::PathBuf::from("test_data").join(format!("{}.json", id));

    if !file_path.exists() {
        return Err("テストスイートが見つかりません".to_string());
    }

    let file_content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    let content = file_content.trim_start_matches('\u{feff}');
    let data: TestSuiteData =
        serde_json::from_str(content).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    Ok(data)
}

#[command]
fn delete_test_suite(id: String) -> Result<(), String> {
    let data_file_path = PathBuf::from("test_data").join(format!("{}.json", id));
    if data_file_path.exists() {
        fs::remove_file(&data_file_path)
            .map_err(|e| format!("Failed to delete test data file: {}", e))?;
    }

    let results_dir_path = PathBuf::from("test_results").join(&id);
    if results_dir_path.exists() {
        fs::remove_dir_all(&results_dir_path)
            .map_err(|e| format!("Failed to delete test results directory: {}", e))?;
    }

    Ok(())
}

#[command]
fn rename_test_suite(id: String, new_name: String) -> Result<(), String> {
    let dir_path = PathBuf::from("test_data");
    let file_path = dir_path.join(format!("{}.json", id));

    if !file_path.exists() {
        return Err("Test suite not found".to_string());
    }

    let file_content =
        fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;
    let content = file_content.trim_start_matches('\u{feff}');
    let mut data: TestSuiteData =
        serde_json::from_str(content).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    data.name = new_name;

    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize test suite data: {}", e))?;
    fs::write(&file_path, json).map_err(|e| format!("Failed to write file: {}", e))?;

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
fn check_test_result_exists(test_suite_id: String, file_name: String) -> Result<bool, String> {
    let file_path = PathBuf::from("test_results")
        .join(&test_suite_id)
        .join(&file_name);
    Ok(file_path.exists())
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
fn create_test_suite(name: String, test_suite_id: String, precondition: Option<String>) -> Result<TestSuiteData, String> {
    let dir_path = PathBuf::from("test_data");
    fs::create_dir_all(&dir_path).map_err(|e| format!("Failed to create directory: {}", e))?;

    let file_path = dir_path.join(format!("{}.json", test_suite_id));

    let data = TestSuiteData {
        id: test_suite_id.clone(),
        name: name.clone(),
        test_cases: Vec::new(),
        precondition: precondition.clone(),
    };
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize test suite data: {}", e))?;
    fs::write(&file_path, json).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(data)
}

#[command]
fn get_app_version(app_handle: AppHandle) -> Result<String, String> {
    Ok(app_handle.package_info().version.to_string())
}

fn main() {
    if let Ok(config) = load_config() {
        *CONFIG.lock().unwrap() = Some(config);
    } else {
        eprintln!("警告: 設定ファイルの読み込みに失敗しました");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            save_test_result,
            save_test_suite,
            get_test_suites,
            get_test_suite,
            create_test_suite,
            rename_test_suite,
            delete_test_suite,
            get_user_name,
            update_user_name,
            get_test_results,
            delete_test_result,
            check_test_result_exists,
            get_app_version,
            save_test_template,
            get_test_templates,
            get_test_template,
            update_test_template,
            delete_test_template
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
