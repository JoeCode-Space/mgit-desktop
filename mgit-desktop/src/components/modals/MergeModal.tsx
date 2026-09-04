import { useState, useMemo, type FC } from 'react';
import { GitMerge, X, Loader2, Info, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { RepoStatus } from '../../types';

export interface MergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRepos: string[];
  allRepos: RepoStatus[];
  onMerge: (targetBranch: string, repos?: string[]) => Promise<void>;
}

export const MergeModal: FC<MergeModalProps> = ({
  isOpen,
  onClose,
  selectedRepos,
  allRepos,
  onMerge,
}) => {
  const [branchToMerge, setBranchToMerge] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Target repos
  const targetReposList = useMemo(() => {
    if (selectedRepos.length > 0) {
      const selectedSet = new Set(selectedRepos);
      return allRepos.filter((r) => selectedSet.has(r.path));
    }
    return allRepos;
  }, [selectedRepos, allRepos]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const branch = branchToMerge.trim();
    if (!branch) {
      setError('请输入要合并的来源分支名称');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const repoPaths = selectedRepos.length > 0 ? selectedRepos : undefined;
      await onMerge(branch, repoPaths);
      onClose();
    } catch (err: any) {
      setError(err?.message || '批量合并分支失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                批量合并分支 (Merge)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                将指定分支的代码合并入各个仓库的当前分支
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form id="merge-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Branch input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              待合并的分支名称 (Branch to merge) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={branchToMerge}
                onChange={(e) => setBranchToMerge(e.target.value)}
                placeholder="例如: origin/main 或 dev"
                disabled={isLoading}
                required
                autoFocus
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
              <GitMerge className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            </div>
          </div>

          {/* Informational Alert */}
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div className="space-y-0.5 leading-relaxed">
              <p className="font-semibold">即将执行的操作：</p>
              <p>
                mgit 将在所有目标仓库中执行{' '}
                <code className="px-1 py-0.5 rounded bg-amber-100/80 dark:bg-amber-900/60 font-mono">
                  git merge --no-edit {branchToMerge || '<branch>'}
                </code>
                。如果遇到代码冲突，需要您进入相应仓库解决。
              </p>
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Affected Repositories Preview */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                目标仓库 ({targetReposList.length} 个)
              </span>
              <span className="text-[11px]">
                {selectedRepos.length > 0 ? '已勾选仓库' : '当前模块全部仓库'}
              </span>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-lg max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
              {targetReposList.length === 0 ? (
                <div className="p-3 text-center text-slate-400 text-xs">没有匹配的仓库</div>
              ) : (
                targetReposList.map((repo) => (
                  <div
                    key={repo.path}
                    className="flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-100/60 dark:hover:bg-slate-800/40"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {repo.name}
                      </span>
                      <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
                        ({repo.relative_path || repo.path})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px] text-slate-600 dark:text-slate-300">
                        当前: {repo.branch || 'HEAD'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="submit"
            form="merge-form"
            disabled={isLoading || targetReposList.length === 0 || !branchToMerge.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm transition disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>合并中...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>开始合并</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
