import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type {
  MgitConfig,
  RepoStatus,
  GitOpResult,
  LogEvent,
  ScanSummary,
  BranchSummary,
  UseMgitReturn,
} from '../types';

export const DEFAULT_WORKSPACE = '/Users/joe/Documents/antigravity/quick-volta';
const WORKSPACE_KEY = 'mgit_workspace';

/**
 * Check if the application is running inside a Tauri WebView environment.
 */
export const isTauri = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
  );
};

const MOCK_CONFIG: MgitConfig = {
  modules: {
    all: ['mgit-desktop', 'services/core', 'libs/common'],
    frontend: ['mgit-desktop'],
    backend: ['services/core', 'libs/common'],
  },
};

const MOCK_BRANCHES: BranchSummary = {
  local: ['main', 'master', 'dev', 'test', 'feature/login', 'release/v1.0'],
  remote: ['origin/main', 'origin/master', 'origin/dev', 'origin/feature/login'],
};

const createMockRepoStatus = (repoPath: string, workspaceDir: string): RepoStatus => {
  const name = repoPath.split('/').filter(Boolean).pop() || repoPath;
  return {
    name,
    path: `${workspaceDir}/${repoPath}`,
    relative_path: repoPath,
    branch: 'main',
    dirty: false,
    ahead: 0,
    behind: 0,
    latest_commit: 'a1b2c3d Initial mock commit',
  };
};

export function useMgit(): UseMgitReturn {
  const isTauriEnv = isTauri();

  const [workspace, setWorkspaceState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(WORKSPACE_KEY);
      if (saved) return saved;
    }
    return DEFAULT_WORKSPACE;
  });

  const [config, setConfig] = useState<MgitConfig | null>(null);
  const [currentModule, setCurrentModule] = useState<string>('');
  const [repos, setRepos] = useState<RepoStatus[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [operationStatus, setOperationStatus] = useState<string | null>(null);

  // Keep latest state in refs for async callback accessibility
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;

  const configRef = useRef(config);
  configRef.current = config;

  const currentModuleRef = useRef(currentModule);
  currentModuleRef.current = currentModule;

  const selectedPathsRef = useRef(selectedPaths);
  selectedPathsRef.current = selectedPaths;

  const reposRef = useRef(repos);
  reposRef.current = repos;

  const modules = config ? Object.keys(config.modules) : [];

  const addLog = useCallback((log: LogEvent) => {
    setLogs((prev) => [...prev.slice(-999), log]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Event listener for backend log stream
  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;
    listen<LogEvent>('mgit://log', (event) => {
      addLog(event.payload);
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((err) => {
        console.error('Failed to setup mgit://log listener:', err);
      });

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [addLog]);

  const refreshStatus = useCallback(async () => {
    const ws = workspaceRef.current;
    const cfg = configRef.current;
    const mod = currentModuleRef.current;
    const currentSelected = selectedPathsRef.current;

    const targetRepoPaths = cfg?.modules[mod] || reposRef.current.map((r) => r.relative_path);
    if (targetRepoPaths.length === 0) {
      return;
    }

    setLoading(true);
    setOperationStatus('正在刷新仓库状态...');
    try {
      if (isTauri()) {
        const statusList = await invoke<RepoStatus[]>('get_repos_status', {
          workspace: ws,
          repos: targetRepoPaths,
        });
        setRepos(
          statusList.map((r) => ({
            ...r,
            selected: currentSelected.has(r.relative_path) || currentSelected.has(r.path),
          }))
        );
      } else {
        const mockStatuses = targetRepoPaths.map((r) => ({
          ...createMockRepoStatus(r, ws),
          selected: currentSelected.has(r),
        }));
        setRepos(mockStatuses);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      addLog({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `刷新状态失败: ${errorMsg}`,
      });
    } finally {
      setLoading(false);
      setOperationStatus(null);
    }
  }, [addLog]);

  const switchModule = useCallback(
    async (mod: string) => {
      setCurrentModule(mod);
      setSelectedPaths(new Set());
      const cfg = configRef.current;
      const ws = workspaceRef.current;
      const targetRepoPaths = cfg?.modules[mod] || [];

      if (targetRepoPaths.length === 0) {
        setRepos([]);
        return;
      }

      setLoading(true);
      setOperationStatus(`正在加载模块 [${mod}] 仓库状态...`);
      try {
        if (isTauri()) {
          const statusList = await invoke<RepoStatus[]>('get_repos_status', {
            workspace: ws,
            repos: targetRepoPaths,
          });
          setRepos(statusList.map((r) => ({ ...r, selected: false })));
        } else {
          const mockStatuses = targetRepoPaths.map((r) => createMockRepoStatus(r, ws));
          setRepos(mockStatuses);
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        addLog({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `获取模块 [${mod}] 状态失败: ${errorMsg}`,
        });
      } finally {
        setLoading(false);
        setOperationStatus(null);
      }
    },
    [addLog]
  );

  const setWorkspace = useCallback(
    async (dir: string) => {
      setWorkspaceState(dir);
      if (typeof window !== 'undefined') {
        localStorage.setItem(WORKSPACE_KEY, dir);
      }

      setLoading(true);
      setOperationStatus('正在加载工作区配置...');
      try {
        if (isTauri()) {
          const cfg = await invoke<MgitConfig>('load_workspace_config', { workspace: dir });
          setConfig(cfg);
          const mods = Object.keys(cfg.modules || {});
          const targetMod = mods.includes('all') ? 'all' : (mods[0] || '');
          setCurrentModule(targetMod);
          setSelectedPaths(new Set());

          const targetRepoPaths = cfg.modules[targetMod] || [];
          if (targetRepoPaths.length > 0) {
            setOperationStatus('正在获取仓库状态...');
            const statusList = await invoke<RepoStatus[]>('get_repos_status', {
              workspace: dir,
              repos: targetRepoPaths,
            });
            setRepos(statusList.map((r) => ({ ...r, selected: false })));
          } else {
            setRepos([]);
          }

          addLog({
            timestamp: new Date().toISOString(),
            level: 'info',
            message: `已加载工作区配置: ${dir} (${mods.length} 个模块)`,
          });
        } else {
          // Browser mock fallback
          setConfig(MOCK_CONFIG);
          const mods = Object.keys(MOCK_CONFIG.modules);
          const targetMod = mods.includes('all') ? 'all' : (mods[0] || '');
          setCurrentModule(targetMod);
          setSelectedPaths(new Set());
          const targetRepoPaths = MOCK_CONFIG.modules[targetMod] || [];
          const mockStatuses = targetRepoPaths.map((r) => createMockRepoStatus(r, dir));
          setRepos(mockStatuses);
          addLog({
            timestamp: new Date().toISOString(),
            level: 'info',
            message: `[Mock] 已加载浏览器模拟工作区配置: ${dir}`,
          });
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setConfig(null);
        setCurrentModule('');
        setRepos([]);
        setSelectedPaths(new Set());
        addLog({
          timestamp: new Date().toISOString(),
          level: 'warn',
          message: `加载配置失败或工作区未初始化 (${errorMsg})，可执行扫描以生成配置`,
        });
      } finally {
        setLoading(false);
        setOperationStatus(null);
      }
    },
    [addLog]
  );

  // Initial load on mount
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      setWorkspace(workspace);
    }
  }, [workspace, setWorkspace]);

  const toggleSelectRepo = useCallback((path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }

      setRepos((prevRepos) =>
        prevRepos.map((r) => ({
          ...r,
          selected: next.has(r.relative_path) || next.has(r.path),
        }))
      );
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((selectAll?: boolean) => {
    setRepos((prevRepos) => {
      const allCurrentlySelected =
        prevRepos.length > 0 &&
        prevRepos.every(
          (r) =>
            selectedPathsRef.current.has(r.relative_path) ||
            selectedPathsRef.current.has(r.path)
        );

      const shouldSelect = selectAll !== undefined ? selectAll : !allCurrentlySelected;

      const nextSelected = new Set<string>();
      if (shouldSelect) {
        for (const r of prevRepos) {
          nextSelected.add(r.relative_path);
        }
      }
      setSelectedPaths(nextSelected);

      return prevRepos.map((r) => ({
        ...r,
        selected: shouldSelect,
      }));
    });
  }, []);

  const resolveTargets = (targetRepos?: string[]): string[] => {
    if (targetRepos && targetRepos.length > 0) {
      return targetRepos;
    }
    if (selectedPathsRef.current.size > 0) {
      return Array.from(selectedPathsRef.current);
    }
    const currentMod = currentModuleRef.current;
    const cfg = configRef.current;
    if (cfg && currentMod && cfg.modules[currentMod]?.length) {
      return cfg.modules[currentMod];
    }
    return reposRef.current.map((r) => r.relative_path);
  };

  const runPull = useCallback(
    async (targetRepos?: string[]): Promise<GitOpResult[]> => {
      const targets = resolveTargets(targetRepos);
      if (targets.length === 0) {
        addLog({
          timestamp: new Date().toISOString(),
          level: 'warn',
          message: '未选择要拉取的仓库',
        });
        return [];
      }

      const ws = workspaceRef.current;
      setLoading(true);
      setOperationStatus(`正在拉取 ${targets.length} 个仓库...`);
      addLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `开始批量拉取 ${targets.length} 个仓库...`,
      });

      try {
        let results: GitOpResult[];
        if (isTauri()) {
          results = await invoke<GitOpResult[]>('git_pull', { workspace: ws, repos: targets });
        } else {
          results = targets.map((repo) => ({
            repo,
            success: true,
            message: 'Already up to date. (Mock)',
          }));
        }

        const successCount = results.filter((r) => r.success).length;
        const failCount = results.length - successCount;
        addLog({
          timestamp: new Date().toISOString(),
          level: failCount === 0 ? 'success' : 'warn',
          message: `批量拉取完成: 成功 ${successCount} 个，失败 ${failCount} 个`,
        });

        await refreshStatus();
        return results;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        addLog({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `批量拉取异常: ${errorMsg}`,
        });
        throw err;
      } finally {
        setLoading(false);
        setOperationStatus(null);
      }
    },
    [addLog, refreshStatus]
  );

  const runPush = useCallback(
    async (targetRepos?: string[]): Promise<GitOpResult[]> => {
      const targets = resolveTargets(targetRepos);
      if (targets.length === 0) {
        addLog({
          timestamp: new Date().toISOString(),
          level: 'warn',
          message: '未选择要推送的仓库',
        });
        return [];
      }

      const ws = workspaceRef.current;
      setLoading(true);
      setOperationStatus(`正在推送 ${targets.length} 个仓库...`);
      addLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `开始批量推送 ${targets.length} 个仓库...`,
      });

      try {
        let results: GitOpResult[];
        if (isTauri()) {
          results = await invoke<GitOpResult[]>('git_push', { workspace: ws, repos: targets });
        } else {
          results = targets.map((repo) => ({
            repo,
            success: true,
            message: 'Everything up-to-date (Mock)',
          }));
        }

        const successCount = results.filter((r) => r.success).length;
        const failCount = results.length - successCount;
        addLog({
          timestamp: new Date().toISOString(),
          level: failCount === 0 ? 'success' : 'warn',
          message: `批量推送完成: 成功 ${successCount} 个，失败 ${failCount} 个`,
        });

        await refreshStatus();
        return results;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        addLog({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `批量推送异常: ${errorMsg}`,
        });
        throw err;
      } finally {
        setLoading(false);
        setOperationStatus(null);
      }
    },
    [addLog, refreshStatus]
  );

  const runCheckout = useCallback(
    async (
      branch: string,
      create: boolean,
      base?: string,
      targetRepos?: string[]
    ): Promise<GitOpResult[]> => {
      const targets = resolveTargets(targetRepos);
      if (targets.length === 0) {
        addLog({
          timestamp: new Date().toISOString(),
          level: 'warn',
          message: '未选择要切换分支的仓库',
        });
        return [];
      }

      const ws = workspaceRef.current;
      setLoading(true);
      setOperationStatus(`正在切换分支至 ${branch}...`);
      addLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `开始在 ${targets.length} 个仓库中切换分支: ${branch} (新建: ${create ? '是' : '否'}${base ? `, 基于: ${base}` : ''})`,
      });

      try {
        let results: GitOpResult[];
        if (isTauri()) {
          results = await invoke<GitOpResult[]>('git_checkout', {
            workspace: ws,
            repos: targets,
            branch,
            create,
            base: base || null,
          });
        } else {
          results = targets.map((repo) => ({
            repo,
            success: true,
            message: `Switched to branch '${branch}' (Mock)`,
          }));
        }

        const successCount = results.filter((r) => r.success).length;
        const failCount = results.length - successCount;
        addLog({
          timestamp: new Date().toISOString(),
          level: failCount === 0 ? 'success' : 'warn',
          message: `切换分支完成: 成功 ${successCount} 个，失败 ${failCount} 个`,
        });

        await refreshStatus();
        return results;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        addLog({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `切换分支异常: ${errorMsg}`,
        });
        throw err;
      } finally {
        setLoading(false);
        setOperationStatus(null);
      }
    },
    [addLog, refreshStatus]
  );

  const runMerge = useCallback(
    async (target: string, targetRepos?: string[]): Promise<GitOpResult[]> => {
      const targets = resolveTargets(targetRepos);
      if (targets.length === 0) {
        addLog({
          timestamp: new Date().toISOString(),
          level: 'warn',
          message: '未选择要合并的仓库',
        });
        return [];
      }

      const ws = workspaceRef.current;
      setLoading(true);
      setOperationStatus(`正在合并分支 ${target}...`);
      addLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `开始在 ${targets.length} 个仓库中合并分支: ${target}`,
      });

      try {
        let results: GitOpResult[];
        if (isTauri()) {
          results = await invoke<GitOpResult[]>('git_merge', {
            workspace: ws,
            repos: targets,
            target,
          });
        } else {
          results = targets.map((repo) => ({
            repo,
            success: true,
            message: `Merged '${target}' successfully (Mock)`,
          }));
        }

        const successCount = results.filter((r) => r.success).length;
        const failCount = results.length - successCount;
        addLog({
          timestamp: new Date().toISOString(),
          level: failCount === 0 ? 'success' : 'warn',
          message: `分支合并完成: 成功 ${successCount} 个，失败 ${failCount} 个`,
        });

        await refreshStatus();
        return results;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        addLog({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `分支合并异常: ${errorMsg}`,
        });
        throw err;
      } finally {
        setLoading(false);
        setOperationStatus(null);
      }
    },
    [addLog, refreshStatus]
  );

  const runCommit = useCallback(
    async (
      message: string,
      push: boolean,
      targetRepos?: string[]
    ): Promise<GitOpResult[]> => {
      const targets = resolveTargets(targetRepos);
      if (targets.length === 0) {
        addLog({
          timestamp: new Date().toISOString(),
          level: 'warn',
          message: '未选择要提交变更的仓库',
        });
        return [];
      }

      const ws = workspaceRef.current;
      setLoading(true);
      setOperationStatus('正在提交变更...');
      addLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `开始在 ${targets.length} 个仓库中提交变更 (附带推送: ${push ? '是' : '否'}): "${message}"`,
      });

      try {
        let results: GitOpResult[];
        if (isTauri()) {
          results = await invoke<GitOpResult[]>('git_commit', {
            workspace: ws,
            repos: targets,
            message,
            push,
          });
        } else {
          results = targets.map((repo) => ({
            repo,
            success: true,
            message: `Committed changes with message '${message}' (Mock)`,
          }));
        }

        const successCount = results.filter((r) => r.success).length;
        const failCount = results.length - successCount;
        addLog({
          timestamp: new Date().toISOString(),
          level: failCount === 0 ? 'success' : 'warn',
          message: `提交变更完成: 成功 ${successCount} 个，失败 ${failCount} 个`,
        });

        await refreshStatus();
        return results;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        addLog({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `提交变更异常: ${errorMsg}`,
        });
        throw err;
      } finally {
        setLoading(false);
        setOperationStatus(null);
      }
    },
    [addLog, refreshStatus]
  );

  const runScan = useCallback(
    async (dir?: string): Promise<ScanSummary> => {
      const targetDir = dir || workspaceRef.current;
      setLoading(true);
      setOperationStatus(`正在扫描工作区 ${targetDir}...`);
      try {
        let summary: ScanSummary;
        if (isTauri()) {
          summary = await invoke<ScanSummary>('scan_workspace', { workspace: targetDir });
        } else {
          summary = {
            total_repos: 3,
            total_modules: 3,
            modules: {
              all: ['mgit-desktop', 'services/core', 'libs/common'],
              frontend: ['mgit-desktop'],
              backend: ['services/core', 'libs/common'],
            },
          };
        }

        addLog({
          timestamp: new Date().toISOString(),
          level: 'success',
          message: `工作区扫描完成: 发现 ${summary.total_repos} 个仓库，${summary.total_modules} 个模块`,
        });
        return summary;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        addLog({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `扫描工作区失败: ${errorMsg}`,
        });
        throw err;
      } finally {
        setLoading(false);
        setOperationStatus(null);
      }
    },
    [addLog]
  );

  const saveConfig = useCallback(
    async (newConfig: MgitConfig): Promise<void> => {
      const ws = workspaceRef.current;
      setLoading(true);
      setOperationStatus('正在保存工作区配置...');
      try {
        if (isTauri()) {
          await invoke('save_workspace_config', { workspace: ws, config: newConfig });
        }
        setConfig(newConfig);
        const mods = Object.keys(newConfig.modules || {});
        if (!mods.includes(currentModuleRef.current)) {
          const nextMod = mods.includes('all') ? 'all' : (mods[0] || '');
          setCurrentModule(nextMod);
        }

        addLog({
          timestamp: new Date().toISOString(),
          level: 'success',
          message: '工作区配置 (mgit.yaml) 保存成功',
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        addLog({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `保存工作区配置失败: ${errorMsg}`,
        });
        throw err;
      } finally {
        setLoading(false);
        setOperationStatus(null);
      }
    },
    [addLog]
  );

  const openTerminal = useCallback(
    async (path: string): Promise<void> => {
      try {
        if (isTauri()) {
          await invoke('open_in_terminal', { path });
        } else {
          console.log('[Browser Mock] open_in_terminal:', path);
        }
        addLog({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `在终端中打开: ${path}`,
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        addLog({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `打开终端失败: ${errorMsg}`,
        });
        throw err;
      }
    },
    [addLog]
  );

  const openFinder = useCallback(
    async (path: string): Promise<void> => {
      try {
        if (isTauri()) {
          await invoke('open_in_finder', { path });
        } else {
          console.log('[Browser Mock] open_in_finder:', path);
        }
        addLog({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `在文件管理器中打开: ${path}`,
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        addLog({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `打开文件管理器失败: ${errorMsg}`,
        });
        throw err;
      }
    },
    [addLog]
  );

  const pickDirectory = useCallback(
    async (defaultPath?: string): Promise<string | null> => {
      try {
        if (isTauri()) {
          const result = await invoke<string | null>('pick_directory', { defaultPath });
          return result;
        } else {
          return window.prompt('请输入工作区绝对路径 (Browser Mock):', defaultPath || workspaceRef.current);
        }
      } catch (err: unknown) {
        console.warn('pick_directory error, falling back to prompt:', err);
        return window.prompt('请输入工作区绝对路径:', defaultPath || workspaceRef.current);
      }
    },
    []
  );

  const getBranches = useCallback(
    async (targetRepos?: string[]): Promise<BranchSummary> => {
      const ws = workspaceRef.current;
      const cfg = configRef.current;
      const mod = currentModuleRef.current;

      const reposToQuery =
        targetRepos && targetRepos.length > 0
          ? targetRepos
          : cfg?.modules[mod] || reposRef.current.map((r) => r.relative_path);

      if (reposToQuery.length === 0) {
        return { local: [], remote: [] };
      }

      if (isTauri()) {
        try {
          return await invoke<BranchSummary>('get_workspace_branches', {
            workspace: ws,
            repos: reposToQuery,
          });
        } catch (err) {
          console.error('Failed to get branches:', err);
          return { local: [], remote: [] };
        }
      } else {
        return MOCK_BRANCHES;
      }
    },
    []
  );

  return {
    workspace,
    config,
    currentModule,
    modules,
    repos,
    selectedPaths,
    logs,
    loading,
    operationStatus,
    isTauriEnvironment: isTauriEnv,
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
    pickDirectory,
    openTerminal,
    openFinder,
    clearLogs,
    addLog,
    getBranches,
  };
}

export default useMgit;
