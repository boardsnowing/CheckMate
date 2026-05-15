import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { TestCase, TestSuite, PreconditionDetails } from "./types/TestCase";
import PreconditionEdit from "./components/PreconditionEdit";
import PreconditionView from "./components/PreconditionView";
import {
  parseLegacyPrecondition,
  generateLegacyPrecondition,
  hasNewFormat,
  extractNewFormat
} from "./utils/preconditionUtils";
import TestCaseEdit from "./components/TestCaseEdit";
import TestCaseResult from "./components/TestCaseResult";
import TestCaseHistory from "./components/TestCaseHistory";

function TestCaseList() {
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
  const [preconditionDetails, setPreconditionDetails] = useState<PreconditionDetails>({});
  const [isPreconditionEditOpen, setIsPreconditionEditOpen] = useState(false);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(true);

  // 一番上に戻る機能
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    result: "OK" | "NG" | "N/A",
    caseResult: "OK" | "NG" | "未実施"
  ) => {
    const updatedCases = [...testCases];
    updatedCases[caseIndex].steps[stepIndex].result = result;
    updatedCases[caseIndex].result = caseResult;
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
          // 新形式の4項目データを追加
          purpose: preconditionDetails.purpose || undefined,
          environment: preconditionDetails.environment || undefined,
          tools: preconditionDetails.tools || undefined,
          preparation: preconditionDetails.preparation || undefined,
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

  // 前提条件の保存（新形式）
  const savePreconditionDetails = async (newDetails: PreconditionDetails) => {
    try {
      setPreconditionDetails(newDetails);
      // 下位互換用のprecondition文字列も更新
      const legacyPrecondition = generateLegacyPrecondition(newDetails);
      setPrecondition(legacyPrecondition.replace(/\\n/g, "\n").replace(/\\t/g, "\t"));

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

          // 新形式データの読み込み
          if (hasNewFormat(data)) {
            // 4項目データが存在する場合
            const newFormatDetails = extractNewFormat(data);
            setPreconditionDetails(newFormatDetails);
          } else if (unescapedPrecondition) {
            // レガシーデータを4項目に変換
            const parsedDetails = parseLegacyPrecondition(unescapedPrecondition);
            setPreconditionDetails(parsedDetails);
          } else {
            // 空の場合
            setPreconditionDetails({});
          }
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
    if (!autoSaveStartTime || !isAutoSaveEnabled) return;

    const timer = setTimeout(() => {
      saveTestCases();
    }, 10000);

    return () => {
      clearTimeout(timer);
      setAutoSaveStartTime(null);
    };
  }, [autoSaveStartTime, isAutoSaveEnabled]);

  return (
    <div className="p-4">
      {/* スティッキーヘッダー */}
      <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200 -m-4 mb-4 p-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          {/* 左側：戻るボタン、タイトル、一番上に戻るボタン */}
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                await saveTestCases();
                navigate("/");
              }}
              className="px-3 py-1 bg-gray-300 rounded text-sm hover:bg-gray-400 transition-colors"
            >
              戻る
            </button>
            <h2 className="text-lg font-bold">
              テストケース一覧（{suiteName}）
            </h2>
            <button
              onClick={scrollToTop}
              className="p-1 text-gray-600 hover:text-blue-600 transition-colors text-lg"
              title="一番上に戻る"
            >
              ↑
            </button>
          </div>

          {/* 右側：自動保存とモードボタン */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 自動保存トグル */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">自動保存</span>
              <button
                onClick={() => setIsAutoSaveEnabled(!isAutoSaveEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  isAutoSaveEnabled ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isAutoSaveEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* モード切替ボタン */}
            <div className="flex space-x-1">
              <button
                onClick={() => setCurrentMode("edit")}
                className={`px-3 py-1 rounded text-sm ${
                  currentMode === "edit"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                編集
              </button>
              <button
                onClick={() => setCurrentMode("test")}
                className={`px-3 py-1 rounded text-sm ${
                  currentMode === "test"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                テスト
              </button>
              <button
                onClick={() => setCurrentMode("history")}
                className={`px-3 py-1 rounded text-sm ${
                  currentMode === "history"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                閲覧
              </button>
              <button
                onClick={() => navigate(`/test-cases/${suiteId}/merge`)}
                className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
              >
                マージ
              </button>
            </div>
          </div>
        </div>
      </div>

      <PreconditionView
        precondition={precondition}
        preconditionDetails={preconditionDetails}
        onEdit={() => setIsPreconditionEditOpen(true)}
      />

      <PreconditionEdit
        isOpen={isPreconditionEditOpen}
        onClose={() => setIsPreconditionEditOpen(false)}
        onSave={savePreconditionDetails}
        initialPrecondition={precondition}
        initialDetails={preconditionDetails}
      />

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
