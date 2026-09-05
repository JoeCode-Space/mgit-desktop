import { useState, useMemo, type FC } from 'react';
import { GitBranch, X, Loader2, GitFork, AlertCircle, CheckCircle2 } from 'lucide-react';
import { BranchCombobox } from '../common/BranchCombobox';
import type { RepoStatus } from '../../types';

export interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRepos: string[];
  allRepos: RepoStatus[];
  onCheckout: (branch: string, create: boolean, base?: string, repos?: string[]) => Promise<void>;
}

export const CheckoutModal: FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  selectedRepos,
  allRepos,
  onCheckout,
}) => {
  const [targetBranch, setTargetBranch] = useState<string>('');
  const [createBranch, setCreateBranch] = useState<boolean>(false);
  const [baseBranch, setBaseBranch] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Determine affected repos
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
    const branch = targetBranch.trim();
    if (!branch) {
      setError('请输入目标分支名称');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const repoPaths = selectedRepos.length > 0 ? selectedRepos : undefined;
      const base = createBranch && baseBranch.trim() ? baseBranch.trim() : undefined;
      await onCheckout(branch, createBranch, base, repoPaths);
      onClose();
    } catch (err: any) {
      setError(err?.message || '批量切换分支失败');
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
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                检出/切换分支 (Checkout)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                在选中的仓库中批量切换分支或创建新分支
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
        <form id="checkout-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Target Branch */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              目标分支名称 (Target Branch) <span className="text-rose-500">*</span>
            </label>
            <BranchCombobox
              value={targetBranch}
              onChange={setTargetBranch}
              repos={targetReposList.map((r) => r.relative_path || r.path)}
              placeholder="例如: main, dev 或 feature/login"
              required
              autoFocus
              disabled={isLoading}
            />
          </div>

          {/* Create Branch Checkbox */}
          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={createBranch}
                onChange={(e) => setCreateBranch(e.target.checked)}
                disabled={isLoading}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
              />
              <span className="font-medium">创建新分支 (-b)</span>
              <span className="text-slate-400 dark:text-slate-500 text-[11px]">(若分支不存在则创建)</span>
            </label>
          </div>

          {/* Base Branch (conditional) */}
          {createBranch && (
            <div className="space-y-1.5 pl-6 border-l-2 border-indigo-200 dark:border-indigo-900 animate-in fade-in">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                基于分支 (Base Branch, 可选)
              </label>
              <BranchCombobox
                value={baseBranch}
                onChange={setBaseBranch}
                repos={targetReposList.map((r) => r.relative_path || r.path)}
                placeholder="留空则基于当前 HEAD 分支"
                disabled={isLoading}
                icon={<GitFork className="w-3.5 h-3.5" />}
              />
            </div>
          )}

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
                目标仓库列表 ({targetReposList.length} 个)
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
            form="checkout-form"
            disabled={isLoading || targetReposList.length === 0 || !targetBranch.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm transition disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>检出中...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{createBranch ? '创建并切换分支' : '切换分支'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
