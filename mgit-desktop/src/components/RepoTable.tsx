import { useState, useMemo, useRef, useEffect, type FC } from 'react';
import {
  Search,
  X,
  GitBranch,
  CheckCircle2,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Terminal,
  FolderOpen,
  ArrowDownToLine,
  GitFork,
  FolderX,
} from 'lucide-react';
import type { RepoStatus } from '../types';

export interface RepoTableProps {
  repos: RepoStatus[];
  selectedPaths: Set<string>;
  onToggleSelectRepo: (path: string) => void;
  onToggleSelectAll: (selectAll?: boolean) => void;
  onOpenTerminal: (path: string) => void;
  onOpenFinder: (path: string) => void;
  onPullRepo: (repoPath: string) => void;
  loading?: boolean;
  currentModule?: string;
}

export const RepoTable: FC<RepoTableProps> = ({
  repos,
  selectedPaths,
  onToggleSelectRepo,
  onToggleSelectAll,
  onOpenTerminal,
  onOpenFinder,
  onPullRepo,
  loading = false,
  currentModule = '',
}) => {
  const [filterText, setFilterText] = useState('');
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  // Filter repos by name, relative_path or branch
  const filteredRepos = useMemo(() => {
    if (!filterText.trim()) return repos;
    const q = filterText.toLowerCase().trim();
    return repos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.relative_path.toLowerCase().includes(q) ||
        r.branch.toLowerCase().includes(q)
    );
  }, [repos, filterText]);

  // Compute selection stats for currently displayed/filtered items
  const allFilteredSelected =
    filteredRepos.length > 0 &&
    filteredRepos.every(
      (r) => selectedPaths.has(r.relative_path) || selectedPaths.has(r.path)
    );

  const someFilteredSelected =
    filteredRepos.some(
      (r) => selectedPaths.has(r.relative_path) || selectedPaths.has(r.path)
    );

  // Handle indeterminate checkbox state
  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate =
        someFilteredSelected && !allFilteredSelected;
    }
  }, [someFilteredSelected, allFilteredSelected]);

  const handleSelectAllChange = () => {
    if (allFilteredSelected) {
      onToggleSelectAll(false);
    } else {
      onToggleSelectAll(true);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Search & Filter Toolbar */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="搜索仓库名称、相对路径或分支名..."
            className="w-full pl-9 pr-8 py-1.5 text-xs rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
          />
          {filterText && (
            <button
              onClick={() => setFilterText('')}
              title="清除筛选"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
          {filterText ? (
            <span>
              匹配 <strong className="text-blue-600 dark:text-blue-400">{filteredRepos.length}</strong> / 共 {repos.length} 个仓库
            </span>
          ) : (
            <span>
              共 <strong className="text-slate-700 dark:text-slate-200">{repos.length}</strong> 个仓库
            </span>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto min-h-0">
        {repos.length === 0 ? (
          /* Empty State: No Repos in module or workspace uninitialized */
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3 text-slate-400 dark:text-slate-500">
              <FolderX className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
              {currentModule ? `模块 [${currentModule}] 下未找到仓库` : '未加载任何仓库'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              请点击顶部工具栏的【扫描】按钮自动发现 Git 仓库，或者切换其他模块。
            </p>
          </div>
        ) : filteredRepos.length === 0 ? (
          /* Empty State: Filter no match */
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3 text-slate-400 dark:text-slate-500">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
              未找到匹配的仓库
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              没有仓库名称或分支匹配 &quot;{filterText}&quot;
            </p>
            <button
              onClick={() => setFilterText('')}
              className="px-3 py-1 text-xs font-medium bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded text-slate-700 dark:text-slate-200 transition"
            >
              清除搜索条件
            </button>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            {/* Table Header */}
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800/95 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 backdrop-blur-sm z-10 select-none shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <tr>
                <th className="w-10 px-3 py-2.5 text-center">
                  <input
                    ref={selectAllCheckboxRef}
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={handleSelectAllChange}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                    title={allFilteredSelected ? '取消全选' : '全选当前仓库'}
                  />
                </th>
                <th className="px-3 py-2.5 font-semibold">仓库名称与路径</th>
                <th className="px-3 py-2.5 font-semibold w-36">分支</th>
                <th className="px-3 py-2.5 font-semibold w-28 text-center">状态</th>
                <th className="px-3 py-2.5 font-semibold w-28 text-center">同步</th>
                <th className="px-3 py-2.5 font-semibold hidden md:table-cell">最新提交</th>
                <th className="px-3 py-2.5 font-semibold w-28 text-right pr-4">操作</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
              {filteredRepos.map((repo) => {
                const isSelected =
                  selectedPaths.has(repo.relative_path) || selectedPaths.has(repo.path);

                return (
                  <tr
                    key={repo.relative_path || repo.path}
                    onClick={() => onToggleSelectRepo(repo.relative_path || repo.path)}
                    className={`group transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/60 dark:bg-blue-950/30 hover:bg-blue-100/60 dark:hover:bg-blue-950/50'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {/* Checkbox */}
                    <td
                      className="w-10 px-3 py-2 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectRepo(repo.relative_path || repo.path)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                      />
                    </td>

                    {/* Repo Name & Relative Path */}
                    <td className="px-3 py-2 min-w-0">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
                          <GitFork className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{repo.name}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate font-mono">
                          {repo.relative_path || repo.path}
                        </span>
                      </div>
                    </td>

                    {/* Branch Badge */}
                    <td className="px-3 py-2">
                      <div
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 max-w-[130px] truncate"
                        title={`当前分支: ${repo.branch}`}
                      >
                        <GitBranch className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{repo.branch || 'HEAD'}</span>
                      </div>
                    </td>

                    {/* Status Badge (Clean / Dirty) */}
                    <td className="px-3 py-2 text-center">
                      {repo.dirty ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                          title="存在未提交的代码修改"
                        >
                          <AlertCircle className="w-3 h-3 text-amber-500" />
                          <span>Dirty</span>
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          title="工作目录干净，无修改"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>Clean</span>
                        </span>
                      )}
                    </td>

                    {/* Sync Status (Ahead / Behind) */}
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {repo.ahead > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                            title={`领先远端 ${repo.ahead} 个提交 (Ahead)`}
                          >
                            <ArrowUp className="w-2.5 h-2.5" />
                            {repo.ahead}
                          </span>
                        )}
                        {repo.behind > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                            title={`落后远端 ${repo.behind} 个提交 (Behind)`}
                          >
                            <ArrowDown className="w-2.5 h-2.5" />
                            {repo.behind}
                          </span>
                        )}
                        {repo.ahead === 0 && repo.behind === 0 && (
                          <span
                            className="text-[11px] text-slate-400 dark:text-slate-500 font-mono"
                            title="已与远程分支同步"
                          >
                            -
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Latest Commit */}
                    <td className="px-3 py-2 hidden md:table-cell">
                      <p
                        className="text-slate-600 dark:text-slate-400 text-xs truncate max-w-xs xl:max-w-md font-mono"
                        title={repo.latest_commit || '无提交记录'}
                      >
                        {repo.latest_commit || '-'}
                      </p>
                    </td>

                    {/* Row Actions */}
                    <td
                      className="px-3 py-2 text-right pr-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        {/* Pull Single Repo */}
                        <button
                          onClick={() => onPullRepo(repo.relative_path || repo.path)}
                          disabled={loading}
                          title="拉取此仓库 (git pull)"
                          className="p-1 rounded text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          <ArrowDownToLine className="w-3.5 h-3.5" />
                        </button>

                        {/* Open in Terminal */}
                        <button
                          onClick={() => onOpenTerminal(repo.path)}
                          title="在终端中打开"
                          className="p-1 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                        </button>

                        {/* Open in Finder / File Manager */}
                        <button
                          onClick={() => onOpenFinder(repo.path)}
                          title="在文件管理器中打开"
                          className="p-1 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default RepoTable;
