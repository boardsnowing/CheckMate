import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import TestSuiteList from "./TestSuiteList";
import TestCaseList from "./TestCaseList"; // 仮のテストケース画面

//import { invoke } from "@tauri-apps/api/core";
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
        </Routes>
      </div>
    </Router>
  )
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

