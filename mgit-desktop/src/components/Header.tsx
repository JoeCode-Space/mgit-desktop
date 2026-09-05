import type { FC } from 'react';
import {
  FolderGit2,
  FolderOpen,
  Search,
  RefreshCw,
  ArrowDownToLine,
  ArrowUpFromLine,
  GitBranch,
  GitMerge,
  GitCommit,
  Sun,
  Moon,
  Terminal,
  Layers,
  CheckCircle2,
  Settings,
} from 'lucide-react';
import type { MgitConfig, ThemeMode } from '../types';

export interface HeaderProps {
  workspace: string;
  config: MgitConfig | null;
  currentModule: string;
  modules: string[];
  selectedCount: number;
  totalCount: number;
  loading: boolean;
  theme: ThemeMode;
  effectiveTheme: 'dark' | 'light';
  logsCount: number;
  isLogsOpen: boolean;
  onChangeWorkspace: () => void;
  onSwitchModule: (mod: string) => void;
  onScan: () => void;
  onRefresh: () => void;
  onPull: () => void;
  onPush: () => void;
  onCheckout: () => void;
  onMerge: () => void;
  onCommit: () => void;
  onManageModules?: () => void;
  onToggleTheme: () => void;
  onToggleLogs: () => void;
}

export const Header: FC<HeaderProps> = ({
  workspace,
  config,
  currentModule,
  modules,
  selectedCount,
  totalCount,
  loading,
  effectiveTheme,
  logsCount,
  isLogsOpen,
  onChangeWorkspace,
  onSwitchModule,
  onScan,
  onRefresh,
  onPull,
  onPush,
  onCheckout,
  onMerge,
  onCommit,
  onManageModules,
  onToggleTheme,
  onToggleLogs,
}) => {
  // Extract workspace folder name for compact display
  const workspaceBaseName =
    workspace.split('/').filter(Boolean).pop() || workspace || '未设置工作区';

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 select-none px-4 py-2.5 transition-colors shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Branding, Workspace, Module Selector */}
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          {/* Logo */}
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-lg tracking-tight shrink-0">
            <FolderGit2 className="w-6 h-6" />
            <span>mgit</span>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

          {/* Workspace Info & Switcher */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
            <span className="font-semibold text-slate-700 dark:text-slate-200 hidden sm:inline">工作区:</span>
            <span
              className="font-mono text-slate-600 dark:text-slate-300 max-w-[140px] md:max-w-[240px] lg:max-w-[360px] truncate"
              title={`当前工作区: ${workspace}`}
            >
              {workspace ? `${workspaceBaseName} (${workspace})` : '未选择工作区'}
            </span>
            <button
              type="button"
              onClick={onChangeWorkspace}
              title="点击打开系统文件夹选择器，切换工作区目录"
              className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-white hover:bg-slate-50 dark:bg-slate-700 dark:hover:bg-slate-600 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-600 shadow-2xs transition shrink-0"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>切换...</span>
            </button>
          </div>

          {/* Module Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-md px-2 py-1">
            <Layers className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">模块:</span>
            {modules.length > 0 ? (
              <select
                value={currentModule}
                onChange={(e) => onSwitchModule(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200 outline-none cursor-pointer pr-1"
              >
                {modules.map((mod) => {
                  const repoCount = config?.modules[mod]?.length ?? 0;
                  return (
                    <option key={mod} value={mod} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                      {mod} ({repoCount} 仓库)
                    </option>
                  );
                })}
              </select>
            ) : (
              <span className="text-xs text-slate-400 dark:text-slate-500 italic">无模块</span>
            )}
            {onManageModules && (
              <button
                type="button"
                onClick={onManageModules}
                title="管理模块 (配置 mgit.yaml)"
                className="ml-0.5 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Selection status badge */}
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition ${
              selectedCount > 0
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700'
            }`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${selectedCount > 0 ? 'text-blue-500' : 'text-slate-400'}`} />
            <span>
              已选 {selectedCount} / {totalCount} 仓库
            </span>
          </div>
        </div>

        {/* Right: Actions, Theme, Logs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Action Button: Scan */}
          <button
            onClick={onScan}
            disabled={loading}
            title="扫描工作区下的 Git 仓库并更新配置"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition disabled:opacity-50 shadow-sm"
          >
            <Search className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            <span>扫描</span>
          </button>

          {/* Action Button: Refresh */}
          <button
            onClick={onRefresh}
            disabled={loading}
            title="刷新当前模块内所有仓库状态"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 dark:text-slate-300 ${loading ? 'animate-spin text-blue-500' : ''}`} />
            <span>刷新</span>
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

          {/* Action Button: Pull */}
          <button
            onClick={onPull}
            disabled={loading || totalCount === 0}
            title={selectedCount > 0 ? `批量拉取选中的 ${selectedCount} 个仓库` : '批量拉取当前模块全部仓库'}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm transition disabled:opacity-50 disabled:pointer-events-none"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>拉取 (Pull)</span>
          </button>

          {/* Action Button: Push */}
          <button
            onClick={onPush}
            disabled={loading || totalCount === 0}
            title={selectedCount > 0 ? `批量推送选中的 ${selectedCount} 个仓库` : '批量推送当前模块全部仓库'}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition disabled:opacity-50 shadow-sm"
          >
            <ArrowUpFromLine className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            <span>推送 (Push)</span>
          </button>

          {/* Action Button: Checkout */}
          <button
            onClick={onCheckout}
            disabled={loading || totalCount === 0}
            title="批量切换/创建分支"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition disabled:opacity-50 shadow-sm"
          >
            <GitBranch className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            <span>检出</span>
          </button>

          {/* Action Button: Merge */}
          <button
            onClick={onMerge}
            disabled={loading || totalCount === 0}
            title="批量合并目标分支到当前分支"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition disabled:opacity-50 shadow-sm"
          >
            <GitMerge className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            <span>合并</span>
          </button>

          {/* Action Button: Commit */}
          <button
            onClick={onCommit}
            disabled={loading || totalCount === 0}
            title="批量提交代码更改"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition disabled:opacity-50 shadow-sm"
          >
            <GitCommit className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            <span>提交</span>
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            title={`切换主题 (当前: ${effectiveTheme === 'dark' ? '深色' : '浅色'})`}
            className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            {effectiveTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          {/* Logs Toggle */}
          <button
            onClick={onToggleLogs}
            title={isLogsOpen ? '收起操作日志面板' : '展开操作日志面板'}
            className={`relative flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition ${
              isLogsOpen
                ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span className="hidden sm:inline">日志</span>
            {logsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600">
                {logsCount > 99 ? '99+' : logsCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
