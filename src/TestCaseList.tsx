﻿import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { TestCase } from "./types/TestCase";
import TestCaseEdit from "./components/TestCaseEdit";
import TestCaseResult from "./components/TestCaseResult";
import TestCaseHistory from "./components/TestCaseHistory";

const TestCaseList: React.FC = () => {
  const navigate = useNavigate();
  const { suiteId } = useParams<{ suiteId: string }>();
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  type Mode = "edit" | "test" | "history";
  const [currentMode, setCurrentMode] = useState<Mode>("edit");
  const [hasEditChanges, setHasEditChanges] = useState<boolean>(false);
  const [hasResultChanges, setHasResultChanges] = useState<boolean>(false);
  const [editStartTime, setEditStartTime] = useState<number | null>(null);
  const [suiteName, setSuiteName] = useState<string>("");

  // 新しいテストケースを追加
  const addTestCase = () => {
    const newTestCase: TestCase = {
      id: `tc-${Date.now()}`,
      name: "新しいテストケース",
      steps: [{
        step: "手順を入力",
        expected: "期待値を入力"
      }]
    };
    setTestCases([...testCases, newTestCase]);
    setHasEditChanges(true);
  };

  // テストケースの編集を処理
  const handleTestCaseChange = (updatedCases: TestCase[]) => {
    setTestCases(updatedCases);
    if (!hasEditChanges) {
      setEditStartTime(Date.now());
    }
    setHasEditChanges(true);
  };

  // テスト結果を更新
  const handleTestResultChange = (caseIndex: number, stepIndex: number, result: "OK" | "NG" | "N/A") => {
    const updatedCases = [...testCases];
    updatedCases[caseIndex].steps[stepIndex].result = result;
    setTestCases(updatedCases);
    setHasResultChanges(true);
  };

  // テストケースを保存する関数
  const saveTestCases = async () => {
    if (!hasEditChanges && !hasResultChanges) return;

    try {
      await invoke('save_test_cases', { 
        suiteId: suiteId,
        testCases: testCases 
      });
      console.log('テストケースを自動保存しました');

      // 通知を送信する
      let permissionGranted = await isPermissionGranted();
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === 'granted';
      }
      
      if (permissionGranted) {
        await sendNotification({
          title: "保存完了",
          body: "テストケースが正常に保存されました"
        });
      }
      
      setHasEditChanges(false);
      setHasResultChanges(false);
      setEditStartTime(null);
    } catch (error) {
      console.error('テストケースの保存に失敗しました:', error);
    }
  };

  // 初期データの読み込み
  useEffect(() => {
    if (suiteId) {
      // テストケースの読み込み
      invoke<TestCase[]>('get_test_cases', { suiteId: suiteId })
        .then((data) => setTestCases(data))
        .catch((error) => console.error("Error fetching test cases:", error));
      
      // テストスイート名の設定
      setSuiteName(`テストスイート ${suiteId}`);
    }
  }, [suiteId]);

  // 変更監視と自動保存
  useEffect(() => {
    if (!hasEditChanges && !hasResultChanges) return;

    const now = Date.now();
    if (editStartTime && now - editStartTime >= 60000){
      saveTestCases();
    }

  }, [hasEditChanges, hasResultChanges]);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">テストケース一覧（スイート: {suiteId}）</h2>
      <div className="mb-4">
        <div className="flex justify-between items-center">
          <button 
            onClick={() => navigate("/")} 
            className="px-4 py-2 bg-gray-300 rounded"
          >
            戻る
          </button>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentMode("edit")}
              className={`px-4 py-2 rounded ${
                currentMode === "edit"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              編集モード
            </button>
            <button
              onClick={() => setCurrentMode("test")}
              className={`px-4 py-2 rounded ${
                currentMode === "test"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              テストモード
            </button>
            <button
              onClick={() => setCurrentMode("history")}
              className={`px-4 py-2 rounded ${
                currentMode === "history"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              閲覧モード
            </button>
          </div>
        </div>
      </div>

      {currentMode === "edit" ? (
        <TestCaseEdit
          testCases={testCases}
          onTestCaseChange={handleTestCaseChange}
          onAddTestCase={addTestCase}
          onSave={saveTestCases}
        />
      ) : currentMode === "test" ? (
        <TestCaseResult
          testCases={testCases}
          testSuiteId={suiteId || ""}
          testSuiteName={suiteName}
          onTestResultChange={handleTestResultChange}
        />
      ) : (
        <TestCaseHistory
          testCases={testCases}
          testSuiteId={suiteId || ""}
        />
      )}
    </div>
  );
};

export default TestCaseList;
