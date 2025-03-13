import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { TestCase, TestSuite } from "./types/TestCase";
import PreconditionEdit from "./components/PreconditionEdit";
import PreconditionView from "./components/PreconditionView";
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
  const [autoSaveStartTime, setAutoSaveStartTime] = useState<number | null>(
    null
  );
  const [suiteName, setSuiteName] = useState<string>("");
  const [precondition, setPrecondition] = useState<string>("");
  const [isPreconditionEditOpen, setIsPreconditionEditOpen] = useState(false);

  // テストケースの編集を処理
  const handleTestCaseChange = (updatedCases: TestCase[]) => {
    setTestCases(updatedCases);
    if (!hasEditChanges) {
      setAutoSaveStartTime(Date.now());
    }
    setHasEditChanges(true);
  };

  // テスト結果を更新
  const handleTestResultChange = (
    caseIndex: number,
    stepIndex: number,
    result: "OK" | "NG" | "N/A"
  ) => {
    const updatedCases = [...testCases];
    updatedCases[caseIndex].steps[stepIndex].result = result;
    setTestCases(updatedCases);
    
    // テストモード以外の場合のみ保存フラグを更新
    if (currentMode !== "test") {
      if (!hasResultChanges) {
        setAutoSaveStartTime(Date.now());
      }
      setHasResultChanges(true);
    }
  };

  // テストスイートを保存する関数
  const saveTestCases = async () => {
    // テストモードの場合は保存をスキップ
    if (currentMode === "test") return;
    
    if (!hasEditChanges && !hasResultChanges) return;

    try {
      const escapedPrecondition = precondition
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t");
      // テストケースをエスケープ処理
      const escapedTestCases = testCases.map((testCase) => ({
        ...testCase,
        name: testCase.name.replace(/\n/g, "\\n").replace(/\t/g, "\\t"),
        steps: testCase.steps.map((step) => ({
          ...step,
          step: step.step.replace(/\n/g, "\\n").replace(/\t/g, "\\t"),
          expected: step.expected.replace(/\n/g, "\\n").replace(/\t/g, "\\t"),
        })),
      }));

      // TestSuiteとして保存
      await invoke("save_test_suite", {
        testSuite: {
          id: suiteId,
          name: suiteName,
          precondition: escapedPrecondition,
          test_cases: escapedTestCases,
        },
      });
      console.log("テストスイートを自動保存しました");

      // 通知を送信する
      let permissionGranted = await isPermissionGranted();
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === "granted";
      }

      if (permissionGranted) {
        await sendNotification({
          title: "保存完了",
          body: "テストスイートが正常に保存されました",
        });
      }

      setHasEditChanges(false);
      setHasResultChanges(false);
      setAutoSaveStartTime(null);
    } catch (error) {
      console.error("テストスイートの保存に失敗しました:", error);
    }
  };

  // 前提条件の保存
  const savePrecondition = async (newPrecondition: string) => {
    try {
      setPrecondition(newPrecondition);
      setHasEditChanges(true);
      setAutoSaveStartTime(Date.now());
    } catch (error) {
      console.error("前提条件の保存に失敗しました:", error);
    }
  };

  // 初期データの読み込み
  useEffect(() => {
    if (suiteId) {
      // テストスイート全体の読み込み
      invoke<TestSuite>("get_test_suite", { id: suiteId })
        .then((data) => {
          // エスケープシーケンスを削除
          const unescapedPrecondition = data.precondition
            .replace(/\\n/g, "\n")
            .replace(/\\t/g, "\t");
          const unescapedTestCases = data.test_cases.map((testCase) => ({
            ...testCase,
            name: testCase.name.replace(/\\n/g, "\n").replace(/\\t/g, "\t"),
            steps: testCase.steps.map((step) => ({
              ...step,
              step: step.step.replace(/\\n/g, "\n").replace(/\\t/g, "\t"),
              expected: step.expected
                .replace(/\\n/g, "\n")
                .replace(/\\t/g, "\t"),
            })),
          }));
          setTestCases(unescapedTestCases);
          setPrecondition(unescapedPrecondition || "");
          setSuiteName(data.name);
        })
        .catch((error) => console.error("Error fetching test suite:", error));
    }
  }, [suiteId]);

  // キーボードショートカットの設定
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl + Shift + キーの組み合わせを検出
      if (event.ctrlKey && event.shiftKey) {
        switch (event.key.toLowerCase()) {
          case "e":
            setCurrentMode("edit");
            break;
          case "t":
            setCurrentMode("test");
            break;
          case "w":
            setCurrentMode("history");
            break;
        }
      }
      // Ctrl + Tab でモードを循環
      if (event.ctrlKey && event.key === "Tab") {
        event.preventDefault(); // ブラウザのデフォルトのタブ切り替えを防止
        setCurrentMode((prevMode) => {
          if (event.shiftKey) {
            // Ctrl + Shift + Tab で逆循環
            switch (prevMode) {
              case "edit":
                return "history";
              case "test":
                return "edit";
              case "history":
                return "test";
              default:
                return "edit";
            }
          } else {
            // Ctrl + Tab で順循環
            switch (prevMode) {
              case "edit":
                return "test";
              case "test":
                return "history";
              case "history":
                return "edit";
              default:
                return "edit";
            }
          }
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 変更監視と自動保存
  useEffect(() => {
    if (!hasEditChanges && !hasResultChanges) return;
  }, [hasEditChanges, hasResultChanges, precondition]);

  //保存タイマー処理
  useEffect(() => {
    if (!autoSaveStartTime) return;

    const timer = setTimeout(() => {
      saveTestCases();
    }, 10000);

    return () => {
      clearTimeout(timer);
      setAutoSaveStartTime(null);
    };
  }, [autoSaveStartTime]);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">
        テストケース一覧（{suiteName}）
      </h2>

      <PreconditionView
        precondition={precondition}
        onEdit={() => setIsPreconditionEditOpen(true)}
      />

      <PreconditionEdit
        isOpen={isPreconditionEditOpen}
        onClose={() => setIsPreconditionEditOpen(false)}
        onSave={savePrecondition}
        initialPrecondition={precondition}
      />
      <div className="mb-4">
        <div className="flex justify-between items-center">
          <button
            onClick={async () => {
              await saveTestCases();
              navigate("/");
            }}
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
        <TestCaseHistory testCases={testCases} testSuiteId={suiteId || ""} />
      )}
    </div>
  );
};

export default TestCaseList;
