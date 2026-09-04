import { useState, useCallback } from 'react';
import { useMgit } from './hooks/useMgit';
import { useTheme } from './hooks/useTheme';
import { Header } from './components/Header';
import { RepoTable } from './components/RepoTable';
import { LogDrawer } from './components/LogDrawer';
import { ScanModal } from './components/modals/ScanModal';
import { CheckoutModal } from './components/modals/CheckoutModal';
import { MergeModal } from './components/modals/MergeModal';
import { CommitModal } from './components/modals/CommitModal';
import { ModuleModal } from './components/modals/ModuleModal';
import type { MgitConfig } from './types';

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
    runCheckout,
    runMerge,
    runCommit,
    runScan,
    saveConfig,
    openTerminal,
    openFinder,
    clearLogs,
  } = useMgit();

  const { theme, effectiveTheme, toggleTheme } = useTheme();

  // Log drawer open/close state
  const [isLogsOpen, setIsLogsOpen] = useState<boolean>(false);

  // Modal open/close states
  const [isScanOpen, setIsScanOpen] = useState<boolean>(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [isMergeOpen, setIsMergeOpen] = useState<boolean>(false);
  const [isCommitOpen, setIsCommitOpen] = useState<boolean>(false);
  const [isModuleOpen, setIsModuleOpen] = useState<boolean>(false);

  // Workspace change handler
  const handleChangeWorkspace = useCallback(async () => {
    const input = window.prompt('请输入工作区绝对路径 (Workspace Directory):', workspace);
    if (input && input.trim() && input.trim() !== workspace) {
      await setWorkspace(input.trim());
    }
  }, [workspace, setWorkspace]);

  // Header action handlers
  const handleScan = useCallback(() => {
    setIsScanOpen(true);
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
    setIsCheckoutOpen(true);
  }, []);

  const handleMerge = useCallback(() => {
    setIsMergeOpen(true);
  }, []);

  const handleCommit = useCallback(() => {
    setIsCommitOpen(true);
  }, []);

  const handleManageModules = useCallback(() => {
    setIsModuleOpen(true);
  }, []);

  const handlePullRepo = useCallback(
    async (repoPath: string) => {
      setIsLogsOpen(true);
      await runPull([repoPath]);
    },
    [runPull]
  );

  // Modal action handlers
  const handlePerformScan = useCallback(
    async (dir: string) => {
      setIsLogsOpen(true);
      return await runScan(dir);
    },
    [runScan]
  );

  const handleApplyScanConfig = useCallback(
    async (modulesMap: Record<string, string[]>) => {
      await saveConfig({ modules: modulesMap });
    },
    [saveConfig]
  );

  const handlePerformCheckout = useCallback(
    async (branch: string, create: boolean, base?: string, targetRepos?: string[]) => {
      setIsLogsOpen(true);
      await runCheckout(branch, create, base, targetRepos);
    },
    [runCheckout]
  );

  const handlePerformMerge = useCallback(
    async (targetBranch: string, targetRepos?: string[]) => {
      setIsLogsOpen(true);
      await runMerge(targetBranch, targetRepos);
    },
    [runMerge]
  );

  const handlePerformCommit = useCallback(
    async (message: string, push: boolean, targetRepos?: string[]) => {
      setIsLogsOpen(true);
      await runCommit(message, push, targetRepos);
    },
    [runCommit]
  );

  const handleSaveModuleConfig = useCallback(
    async (newConfig: MgitConfig) => {
      await saveConfig(newConfig);
    },
    [saveConfig]
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
        onManageModules={handleManageModules}
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

      {/* Modals */}
      <ScanModal
        isOpen={isScanOpen}
        onClose={() => setIsScanOpen(false)}
        currentWorkspace={workspace}
        onScan={handlePerformScan}
        onApplyConfig={handleApplyScanConfig}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        selectedRepos={Array.from(selectedPaths)}
        allRepos={repos}
        onCheckout={handlePerformCheckout}
      />

      <MergeModal
        isOpen={isMergeOpen}
        onClose={() => setIsMergeOpen(false)}
        selectedRepos={Array.from(selectedPaths)}
        allRepos={repos}
        onMerge={handlePerformMerge}
      />

      <CommitModal
        isOpen={isCommitOpen}
        onClose={() => setIsCommitOpen(false)}
        selectedRepos={Array.from(selectedPaths)}
        allRepos={repos}
        onCommit={handlePerformCommit}
      />

      <ModuleModal
        isOpen={isModuleOpen}
        onClose={() => setIsModuleOpen(false)}
        config={config}
        onSaveConfig={handleSaveModuleConfig}
      />
    </div>
  );
}

export default App;
