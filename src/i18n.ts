import { useSyncExternalStore } from "react";

export type Language = "ja" | "en";

const STORAGE_KEY = "checkmate.language";

const english: Record<string, string> = {
  "テストスイート管理": "Test Suite Management",
  "テンプレート管理": "Template Management",
  "ユーザー名: {{name}}": "User: {{name}}",
  "変更": "Change",
  "テストスイートを検索...": "Search test suites...",
  "テスト管理番号": "Test ID",
  "テストスイート名": "Test Suite Name",
  "操作": "Actions",
  "名前変更": "Rename",
  "削除": "Delete",
  "テストスイートを追加": "Add Test Suite",
  "新しいテストスイート": "New Test Suite",
  "キャンセル": "Cancel",
  "追加": "Add",
  "ユーザー名の変更": "Change User Name",
  "ユーザー名の設定": "Set User Name",
  "新しいユーザー名を入力してください": "Enter a new user name.",
  "テスト実行者の名前を設定してください": "Set the tester's name.",
  "新しいユーザー名": "New User Name",
  "テストスイート名の変更": "Rename Test Suite",
  "新しいテストスイート名": "New Test Suite Name",
  "テスト管理番号「{{id}}」は既に使用されています。": "Test ID \"{{id}}\" is already in use.",
  "テストスイート「{{name}}」を削除してもよろしいですか？\n\n関連するすべてのテストケースとテスト結果も削除されます。":
    "Are you sure you want to delete test suite \"{{name}}\"?\n\nAll related test cases and test results will also be deleted.",
  "テストスイートの削除": "Delete Test Suite",
  "戻る": "Back",
  "テストケース一覧（{{name}}）": "Test Cases ({{name}})",
  "一番上に戻る": "Back to top",
  "自動保存": "Autosave",
  "編集": "Edit",
  "テスト": "Test",
  "閲覧": "History",
  "前提条件": "Preconditions",
  "前提条件なし": "No preconditions",
  "項目別": "By section",
  "統合": "Combined",
  "目的": "Purpose",
  "環境": "Environment",
  "使用ツール": "Tools",
  "事前準備": "Preparation",
  "プレビュー": "Preview",
  "前提条件の編集": "Edit Preconditions",
  "({{count}}文字)": "({{count}} characters)",
  "テストの目的や実現したい目標を記述してください（Markdown形式で記述可能）":
    "Describe the purpose of the test or the goal to achieve (Markdown supported).",
  "テスト実行に必要な環境や条件を記述してください（Markdown形式で記述可能）":
    "Describe the environment and conditions required to run the test (Markdown supported).",
  "テストで使用するツールやソフトウェアを記述してください（Markdown形式で記述可能）":
    "Describe the tools and software used in the test (Markdown supported).",
  "テスト実行前に行う準備や設定を記述してください（Markdown形式で記述可能）":
    "Describe the preparation and setup required before running the test (Markdown supported).",
  "統合プレビュー": "Combined Preview",
  "テンプレート編集": "Edit Template",
  "テンプレート作成": "Create Template",
  "保存": "Save",
  "テンプレート名": "Template Name",
  "テンプレート名を入力": "Enter a template name",
  "説明": "Description",
  "テンプレートの説明を入力": "Enter a template description",
  "テスト手順": "Test Steps",
  "手順": "Steps",
  "期待値": "Expected Result",
  "期待値を入力": "Enter the expected result",
  "手順を入力": "Enter a step",
  "手順を追加": "Add Step",
  "挿入": "Insert",
  "テンプレートを選択": "Select a Template",
  "読み込み中...": "Loading...",
  "テンプレートがありません": "No templates found.",
  "テンプレートの読み込みに失敗しました": "Failed to load templates.",
  "テンプレートの削除に失敗しました": "Failed to delete the template.",
  "このテンプレートを削除してもよろしいですか？": "Are you sure you want to delete this template?",
  "テストテンプレート一覧": "Test Templates",
  "新規作成": "Create New",
  "ステップ数: {{count}}": "{{count}} steps",
  "テストケースを挿入": "Insert Test Case",
  "テストケースを複製": "Duplicate Test Case",
  "テストケースを削除": "Delete Test Case",
  "テストステップを挿入": "Insert Test Step",
  "テンプレートを挿入": "Insert Template",
  "共通手順を挿入": "Insert Shared Procedure",
  "テストステップを削除": "Delete Test Step",
  "テストケース追加": "Add Test Case",
  "共通手順管理": "Manage Shared Procedures",
  "テストケース数: {{count}}": "Test Cases: {{count}}",
  "すべて展開": "Expand All",
  "すべて折りたたむ": "Collapse All",
  "Alt + P でプレビュー切替": "Alt + P to toggle preview",
  "テストケースの概要を入力": "Enter a test case summary",
  "新しいテストケース": "New Test Case",
  "複製したテストケースの挿入位置を選択": "Select where to insert the duplicated test case",
  "先頭に挿入": "Insert at beginning",
  "「{{name}}」の後に挿入": "Insert after \"{{name}}\"",
  "テストケース一覧": "Test Case List",
  "ファイル名を入力してください": "Enter a file name.",
  "同名のファイルが既に存在します。上書きしますか？": "A file with this name already exists. Overwrite it?",
  "テスト結果の保存に失敗しました": "Failed to save test results.",
  "未実施": "Not Run",
  "過去のテスト結果:": "Previous Test Results:",
  "選択してください": "Select an option",
  "ファイル名：": "File name:",
  "保存するファイル名を入力": "Enter a file name to save",
  "テスト結果を保存しました": "Test results saved.",
  "テスト結果を保存": "Save Test Results",
  "判定": "Result",
  "コメント": "Comments",
  "*コメントなし*": "*No comment*",
  "不明なテストケース": "Unknown test case",
  "共通手順: {{name}}": "Shared Procedure: {{name}}",
  "テスト結果詳細": "Test Result Details",
  "テストケースを選択してください": "Select a test case",
  "テスト実行履歴": "Test Run History",
  "テスト結果を選択してください": "Select a test result",
  "PDFエクスポート": "Export PDF",
  "CSVエクスポート": "Export CSV",
  "JUnitエクスポート": "Export JUnit",
  "テストケース単位の集計": "Summary by Test Case",
  "テスト結果詳細: {{name}}": "Test Result Details: {{name}}",
  "テスト結果の削除に失敗しました": "Failed to delete test results.",
  "このテスト結果を削除してもよろしいですか？": "Are you sure you want to delete these test results?",
  "PDFエクスポートに失敗しました": "Failed to export PDF.",
  "JUnitエクスポートに失敗しました": "Failed to export JUnit.",
  "CSVエクスポートに失敗しました": "Failed to export CSV.",
  "試験名称": "Test Name",
  "テスト結果集計": "Test Results Summary",
  "テストケース": "Test Case",
  "No": "No.",
  "結果": "Result",
  "実行者: {{name}}": "Executed by: {{name}}",
  "実行日時: {{date}}": "Executed at: {{date}}",
  "共通手順を選択": "Select a Shared Procedure",
  "共通手順がありません": "No shared procedures found.",
  "{{count}}ステップ": "{{count}} steps",
  "共通手順の読み込みに失敗しました": "Failed to load shared procedures.",
  "共通手順の保存に失敗しました: {{error}}": "Failed to save shared procedure: {{error}}",
  "共通手順の削除に失敗しました: {{error}}": "Failed to delete shared procedure: {{error}}",
  "新しい共通手順を作成": "Create a Shared Procedure",
  "この共通手順を削除しますか？": "Are you sure you want to delete this shared procedure?",
  "名称": "Name",
  "共通手順の名称": "Shared procedure name",
  "共通手順の説明": "Shared procedure description",
  "共通手順ステップ": "Shared Procedure Steps",
  "+追加": "+ Add",
  "試験結果マージ": "Merge Test Results",
  "テスト結果の読み込みに失敗しました": "Failed to load test results.",
  "テスト結果の選択": "Select a test result",
  "保存完了": "Saved",
  "テストスイートが正常に保存されました": "The test suite was saved successfully.",
  "すべての競合を解決してください": "Resolve all conflicts.",
  "出力ファイル名を入力してください": "Enter an output file name.",
  "マージ結果を保存しました": "Merged results saved.",
  "マージ結果の保存に失敗しました": "Failed to save merged results.",
  "ファイル1": "File 1",
  "ファイル2": "File 2",
  "実行者:": "Executed by:",
  "実行日時:": "Executed at:",
  "競合の解決": "Resolve Conflicts",
  "ファイル1の結果": "Result from File 1",
  "ファイル2の結果": "Result from File 2",
  "この結果を使用": "Use This Result",
  "出力ファイル名：": "Output file name:",
  "マージ実行": "Merge Results",
  "表示言語": "Language",
};

function readStoredLanguage(): Language {
  if (typeof window === "undefined") return "ja";
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "ja";
  } catch (error) {
    console.error("Failed to load language preference:", error);
    return "ja";
  }
}

let currentLanguage = readStoredLanguage();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setLanguage(language: Language) {
  if (language === currentLanguage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch (error) {
    console.error("Failed to save language preference:", error);
  }
  currentLanguage = language;
  listeners.forEach((listener) => listener());
}

export function t(
  key: string,
  values: Record<string, string | number> = {},
): string {
  const message = currentLanguage === "en" ? english[key] ?? key : key;
  return message.replace(/\{\{(\w+)\}\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name)
      ? String(values[name])
      : placeholder,
  );
}

export function localizePrecondition(markdown: string): string {
  if (currentLanguage !== "en") return markdown;
  return markdown.replace(
    /^(#{1,2}\s*)(目的|環境|使用ツール|事前準備)\s*$/gm,
    (_match, prefix: string, title: string) => `${prefix}${t(title)}`,
  );
}

export function useI18n() {
  const language = useSyncExternalStore(
    subscribe,
    () => currentLanguage,
    () => "ja",
  );
  return { language };
}
