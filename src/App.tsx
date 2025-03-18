import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import TestSuiteList from "./TestSuiteList";
import TestCaseList from "./TestCaseList";
import TestTemplateEdit from "./components/TestTemplateEdit";
import TestTemplateList from "./components/TestTemplateList";
//import "./App.css";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen p-4 bg-gray-100">
        <Routes>
          {/* テストスイート画面（初期ページ） */}
          <Route path="/" element={<TestSuiteList />} />

          {/* テストケース画面 */}
          <Route path="/test-cases/:suiteId" element={<TestCaseList />} />

          {/* テンプレート一覧画面 */}
          <Route path="/templates" element={<TestTemplateList />} />

          {/* テンプレート作成画面 */}
          <Route path="/template/create" element={<TestTemplateEdit onSave={async (template) => {
            try {
              await invoke("save_test_template", { template });
              window.history.back();
            } catch (error) {
              console.error("Failed to save template:", error);
            }
          }} onCancel={() => window.history.back()} />} />

          {/* テンプレート編集画面 */}
          <Route path="/template/edit/:templateId" element={<TestTemplateEdit onSave={async (template) => {
            try {
              await invoke("update_test_template", { template });
              window.history.back();
            } catch (error) {
              console.error("Failed to update template:", error);
            }
          }} onCancel={() => window.history.back()} />} />
        </Routes>
      </div>
    </Router>
  );
}

//   return (
//     <main className="container">
//       <h1>Welcome to Tauri + React</h1>

//       <div className="row">
//         <a href="https://vitejs.dev" target="_blank">
//           <img src="/vite.svg" className="logo vite" alt="Vite logo" />
//         </a>
//         <a href="https://tauri.app" target="_blank">
//           <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
//         </a>
//         <a href="https://reactjs.org" target="_blank">
//           <img src={reactLogo} className="logo react" alt="React logo" />
//         </a>
//       </div>
//       <p>Click on the Tauri, Vite, and React logos to learn more.</p>

//       <form
//         className="row"
//         onSubmit={(e) => {
//           e.preventDefault();
//           greet();
//         }}
//       >
//         <input
//           id="greet-input"
//           onChange={(e) => setName(e.currentTarget.value)}
//           placeholder="Enter a name..."
//         />
//         <button type="submit">Greet</button>
//       </form>
//       <p>{greetMsg}</p>
//     </main>
//   );
// }
