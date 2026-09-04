/**
 * mgit configuration representation matching Rust models.
 */
export interface MgitConfig {
  modules: Record<string, string[]>;
}

/**
 * Repository status representation matching Rust models.
 */
export interface RepoStatus {
  name: string;
  path: string;
  relative_path: string;
  branch: string;
  dirty: boolean;
  ahead: number;
  behind: number;
  latest_commit: string;
  selected?: boolean;
}

/**
 * Git batch operation execution result matching Rust models.
 */
export interface GitOpResult {
  repo: string;
  success: boolean;
  message: string;
  raw_output?: string;
  error?: string;
}

/**
 * Log event emitted during git operations matching Rust models.
 */
export interface LogEvent {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  repo?: string;
  message: string;
}

/**
 * Directory scan summary matching Rust models.
 */
export interface ScanSummary {
  total_repos: number;
  total_modules: number;
  modules: Record<string, string[]>;
}

/**
 * Theme mode options.
 */
export type ThemeMode = 'dark' | 'light' | 'system';

/**
 * Return type for useTheme hook.
 */
export interface UseThemeReturn {
  theme: ThemeMode;
  effectiveTheme: 'dark' | 'light';
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

/**
 * Return type for useMgit hook.
 */
export interface UseMgitReturn {
  workspace: string;
  config: MgitConfig | null;
  currentModule: string;
  modules: string[];
  repos: RepoStatus[];
  selectedPaths: Set<string>;
  logs: LogEvent[];
  loading: boolean;
  operationStatus: string | null;
  isTauriEnvironment: boolean;
  setWorkspace: (dir: string) => Promise<void>;
  switchModule: (mod: string) => Promise<void>;
  refreshStatus: () => Promise<void>;
  toggleSelectRepo: (path: string) => void;
  toggleSelectAll: (selectAll?: boolean) => void;
  runPull: (targetRepos?: string[]) => Promise<GitOpResult[]>;
  runPush: (targetRepos?: string[]) => Promise<GitOpResult[]>;
  runCheckout: (branch: string, create: boolean, base?: string, targetRepos?: string[]) => Promise<GitOpResult[]>;
  runMerge: (target: string, targetRepos?: string[]) => Promise<GitOpResult[]>;
  runCommit: (message: string, push: boolean, targetRepos?: string[]) => Promise<GitOpResult[]>;
  runScan: (dir?: string) => Promise<ScanSummary>;
  saveConfig: (newConfig: MgitConfig) => Promise<void>;
  openTerminal: (path: string) => Promise<void>;
  openFinder: (path: string) => Promise<void>;
  clearLogs: () => void;
  addLog: (log: LogEvent) => void;
}
