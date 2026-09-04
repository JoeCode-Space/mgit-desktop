import { useState } from "react";
import { FolderGit2 } from "lucide-react";

export function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-8">
      <header className="flex items-center gap-3 mb-6">
        <FolderGit2 className="w-8 h-8 text-blue-500" />
        <h1 className="text-2xl font-bold">mgit Desktop</h1>
      </header>
      <div className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow border border-slate-200 dark:border-slate-700">
        <p className="mb-4">欢迎使用 mgit 跨平台桌面端应用脚手架。</p>
        <button
          onClick={() => setCount((c) => c + 1)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded shadow transition"
        >
          点击次数: {count}
        </button>
      </div>
    </div>
  );
}

export default App;
