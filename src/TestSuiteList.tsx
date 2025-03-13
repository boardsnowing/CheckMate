import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import { TestSuite } from "./types/TestCase";

export default function TestSuiteList() {
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [filter, setFilter] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newSuiteName, setNewSuiteName] = useState("");
  const [newtestSuiteId, setNewtestSuiteId] = useState("");
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [selectedSuite, setSelectedSuite] = useState<TestSuite | null>(null);
  const [renameSuiteName, setRenameSuiteName] = useState("");
  const [userName, setUserName] = useState("");
  const [isUserNameDialogOpen, setIsUserNameDialogOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [version, setVersion] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    loadTestSuites();
    loadUserName();
    loadVersion();
  }, []);

  const loadVersion = async () => {
    try {
      const ver = await invoke<string>("get_app_version");
      setVersion(ver);
    } catch (error) {
      console.error("Failed to load version:", error);
    }
  };

  const loadUserName = async () => {
    try {
      const name = await invoke<string>("get_user_name");
      setUserName(name);
    } catch (error) {
      console.error("Failed to load user name:", error);
      setIsUserNameDialogOpen(true);
      setNewUserName("");
    }
  };

  const updateUserName = async () => {
    if (!newUserName.trim()) return;

    try {
      await invoke("update_user_name", { newName: newUserName });
      setUserName(newUserName);
      setIsUserNameDialogOpen(false);
      setNewUserName("");
    } catch (error) {
      console.error("Failed to update user name:", error);
    }
  };

  const loadTestSuites = async () => {
    try {
      const suites = await invoke<TestSuite[]>("get_test_suites");
      setTestSuites(suites);
    } catch (error) {
      console.error("Failed to load test suites:", error);
    }
  };

  const addTestSuite = async () => {
    if (!newSuiteName.trim()) return;

    try {
      const newSuite = await invoke<TestSuite>("create_test_suite", {
        name: newSuiteName,
        testSuiteId: newtestSuiteId,
        precondition: "",
      });
      setTestSuites([...testSuites, newSuite]);
      setIsAddDialogOpen(false);
      setNewSuiteName("");
      setNewtestSuiteId("");
    } catch (error) {
      console.error("Failed to create test suite:", error);
    }
  };

  const openRenameDialog = (suite: TestSuite) => {
    setSelectedSuite(suite);
    setRenameSuiteName(suite.name);
    setIsRenameDialogOpen(true);
  };

  const renameTestSuite = async () => {
    if (!selectedSuite || !renameSuiteName.trim()) return;

    try {
      await invoke("rename_test_suite", {
        id: selectedSuite.id,
        newName: renameSuiteName,
      });

      setTestSuites(
        testSuites.map((suite) =>
          suite.id === selectedSuite.id
            ? { ...suite, name: renameSuiteName }
            : suite
        )
      );
      setIsRenameDialogOpen(false);
      setSelectedSuite(null);
    } catch (error) {
      console.error("Failed to rename test suite:", error);
    }
  };

  const deleteTestSuite = async (suite: TestSuite) => {
    const confirmed = await confirm(
      `テストスイート「${suite.name}」を削除してもよろしいですか？\n\n関連するすべてのテストケースとテスト結果も削除されます。`,
      {
        title: "テストスイートの削除",
      }
    );

    if (confirmed) {
      try {
        await invoke("delete_test_suite", { id: suite.id });
        setTestSuites(testSuites.filter((s) => s.id !== suite.id));
      } catch (error) {
        console.error("Failed to delete test suite:", error);
      }
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">テストスイート管理</h1>
          <span className="text-sm text-gray-500">v{version}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>ユーザー名: {userName}</span>
          <button
            className="bg-gray-500 text-white px-2 py-1 rounded"
            onClick={() => {
              setNewUserName(userName);
              setIsUserNameDialogOpen(true);
            }}
          >
            変更
          </button>
        </div>
      </div>

      {/* フィルタリング */}
      <div className="relative mb-4 max-w-2xl mx-auto">
        <input
          type="text"
          placeholder="テストスイートを検索..."
          className="border border-gray-300 rounded-lg pl-8 pr-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {/* テーブル表示 */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                テスト管理番号
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                テストスイート名
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {testSuites
              .filter((suite) => suite.name.includes(filter))
              .map((suite) => (
                <tr
                  key={suite.id}
                  className="hover:bg-gray-50 transition-colors duration-150 ease-in-out cursor-pointer"
                  onDoubleClick={() => navigate(`/test-cases/${suite.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {suite.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{suite.name}</td>
                  <td className="px-6 py-4 text-center whitespace-nowrap">
                    <button
                      className="inline-flex items-center px-3 py-1.5 border border-blue-500 text-blue-500 rounded-md hover:bg-blue-50 mr-2 text-sm transition-colors duration-150"
                      onClick={(e) => {
                        e.stopPropagation();
                        openRenameDialog(suite);
                      }}
                    >
                      名前変更
                    </button>
                    <button
                      className="inline-flex items-center px-3 py-1.5 border border-red-500 text-red-500 rounded-md hover:bg-red-50 text-sm transition-colors duration-150"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTestSuite(suite);
                      }}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* 追加ボタン */}
      <button
        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 mt-4 max-w-2xl mx-auto rounded-lg shadow-sm transition-colors duration-150 flex items-center justify-center"
        onClick={() => setIsAddDialogOpen(true)}
      >
        <span>テストスイートを追加</span>
      </button>

      {/* 追加ダイアログ */}
      {isAddDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg">
            <h2 className="text-lg font-bold mb-4">新しいテストスイート</h2>
            <div className="space-y-4">
              <input
                type="text"
                value={newSuiteName}
                onChange={(e) => setNewSuiteName(e.target.value)}
                placeholder="テストスイート名"
                className="border p-2 w-full"
                required
              />
              <input
                type="text"
                value={newtestSuiteId}
                onChange={(e) => setNewtestSuiteId(e.target.value)}
                placeholder="テスト管理番号"
                className="border p-2 w-full"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="bg-gray-500 text-white p-2"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setNewSuiteName("");
                }}
              >
                キャンセル
              </button>
              <button
                className="bg-blue-500 text-white p-2"
                onClick={addTestSuite}
                disabled={!newSuiteName.trim() || !newtestSuiteId.trim()}
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ユーザー名変更ダイアログ */}
      {isUserNameDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg">
            <h2 className="text-lg font-bold mb-4">
              {userName ? "ユーザー名の変更" : "ユーザー名の設定"}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {userName
                ? "新しいユーザー名を入力してください"
                : "テスト実行者の名前を設定してください"}
            </p>
            <input
              type="text"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              placeholder="新しいユーザー名"
              className="border p-2 w-full mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                className="bg-gray-500 text-white p-2"
                onClick={() => {
                  setIsUserNameDialogOpen(false);
                  setNewUserName("");
                }}
              >
                キャンセル
              </button>
              <button
                className="bg-blue-500 text-white p-2"
                onClick={updateUserName}
              >
                変更
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 名前変更ダイアログ */}
      {isRenameDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg">
            <h2 className="text-lg font-bold mb-4">テストスイート名の変更</h2>
            <input
              type="text"
              value={renameSuiteName}
              onChange={(e) => setRenameSuiteName(e.target.value)}
              placeholder="新しいテストスイート名"
              className="border p-2 w-full mb-4"
              required
            />
            <div className="flex justify-end gap-2">
              <button
                className="bg-gray-500 text-white p-2"
                onClick={() => {
                  setIsRenameDialogOpen(false);
                  setSelectedSuite(null);
                }}
              >
                キャンセル
              </button>
              <button
                className="bg-blue-500 text-white p-2"
                onClick={renameTestSuite}
                disabled={!renameSuiteName.trim()}
              >
                変更
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
