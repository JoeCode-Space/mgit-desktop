import { useState, useCallback } from 'react';
import { useMgit } from './hooks/useMgit';
import { useTheme } from './hooks/useTheme';
import { Header } from './components/Header';
import { RepoTable } from './components/RepoTable';
import { LogDrawer } from './components/LogDrawer';

export function App() {
  const {
    workspace,
    config,
    currentModule,
    modules,
    repos,
    selectedPaths,
    logs,
    loading,
    operationStatus,
    setWorkspace,
    switchModule,
    refreshStatus,
    toggleSelectRepo,
    toggleSelectAll,
    runPull,
    runPush,
    runScan,
    openTerminal,
    openFinder,
    clearLogs,
  } = useMgit();

  const { theme, effectiveTheme, toggleTheme } = useTheme();

  // Log drawer open/close state
  const [isLogsOpen, setIsLogsOpen] = useState<boolean>(false);

  // Modal triggers / placeholders for Task 8
  const [isScanModalOpen, setIsScanModalOpen] = useState<boolean>(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState<boolean>(false);
  const [isCommitModalOpen, setIsCommitModalOpen] = useState<boolean>(false);

  // Workspace change handler
  const handleChangeWorkspace = useCallback(async () => {
    const input = window.prompt('请输入工作区绝对路径 (Workspace Directory):', workspace);
    if (input && input.trim() && input.trim() !== workspace) {
      await setWorkspace(input.trim());
    }
  }, [workspace, setWorkspace]);

  // Header action handlers
  const handleScan = useCallback(() => {
    setIsScanModalOpen(true);
  }, []);

  const handleRefresh = useCallback(async () => {
    await refreshStatus();
  }, [refreshStatus]);

  const handlePull = useCallback(async () => {
    setIsLogsOpen(true);
    await runPull();
  }, [runPull]);

  const handlePush = useCallback(async () => {
    setIsLogsOpen(true);
    await runPush();
  }, [runPush]);

  const handleCheckout = useCallback(() => {
    setIsCheckoutModalOpen(true);
  }, []);

  const handleMerge = useCallback(() => {
    setIsMergeModalOpen(true);
  }, []);

  const handleCommit = useCallback(() => {
    setIsCommitModalOpen(true);
  }, []);

  const handlePullRepo = useCallback(
    async (repoPath: string) => {
      setIsLogsOpen(true);
      await runPull([repoPath]);
    },
    [runPull]
  );

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased">
      {/* Top Application Header & Toolbar */}
      <Header
        workspace={workspace}
        config={config}
        currentModule={currentModule}
        modules={modules}
        selectedCount={selectedPaths.size}
        totalCount={repos.length}
        loading={loading}
        theme={theme}
        effectiveTheme={effectiveTheme}
        logsCount={logs.length}
        isLogsOpen={isLogsOpen}
        onChangeWorkspace={handleChangeWorkspace}
        onSwitchModule={switchModule}
        onScan={handleScan}
        onRefresh={handleRefresh}
        onPull={handlePull}
        onPush={handlePush}
        onCheckout={handleCheckout}
        onMerge={handleMerge}
        onCommit={handleCommit}
        onToggleTheme={toggleTheme}
        onToggleLogs={() => setIsLogsOpen((prev) => !prev)}
      />

      {/* Main Content Area: Repos Table */}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col relative">
        <RepoTable
          repos={repos}
          selectedPaths={selectedPaths}
          onToggleSelectRepo={toggleSelectRepo}
          onToggleSelectAll={toggleSelectAll}
          onOpenTerminal={openTerminal}
          onOpenFinder={openFinder}
          onPullRepo={handlePullRepo}
          loading={loading}
          currentModule={currentModule}
        />
      </main>

      {/* Bottom Console / Log Drawer */}
      <LogDrawer
        logs={logs}
        isOpen={isLogsOpen}
        onToggleOpen={() => setIsLogsOpen((prev) => !prev)}
        onClearLogs={clearLogs}
        operationStatus={operationStatus}
        loading={loading}
      />

      {/* Task 8 Modal Placeholders */}
      {isScanModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setIsScanModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg p-5 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold mb-2">扫描工作区 (Scan Modal)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              交互弹窗组件将在 Task 8 中完整挂载。您也可以直接点击【立即扫描】执行并查看日志。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsScanModalOpen(false)}
                className="px-3 py-1.5 text-xs rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  setIsScanModalOpen(false);
                  setIsLogsOpen(true);
                  await runScan(workspace);
                }}
                className="px-3 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm"
              >
                立即扫描
              </button>
            </div>
          </div>
        </div>
      )}

      {isCheckoutModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setIsCheckoutModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg p-5 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold mb-2">检出/切换分支 (Checkout Modal)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              交互弹窗组件将在 Task 8 中完整挂载。
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setIsCheckoutModalOpen(false)}
                className="px-3 py-1.5 text-xs rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {isMergeModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setIsMergeModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg p-5 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold mb-2">分支合并 (Merge Modal)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              交互弹窗组件将在 Task 8 中完整挂载。
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setIsMergeModalOpen(false)}
                className="px-3 py-1.5 text-xs rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {isCommitModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setIsCommitModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg p-5 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold mb-2">代码提交 (Commit Modal)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              交互弹窗组件将在 Task 8 中完整挂载。
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setIsCommitModalOpen(false)}
                className="px-3 py-1.5 text-xs rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
