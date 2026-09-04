import { useState, useMemo, type FC } from 'react';
import { GitCommit, X, Loader2, ArrowUpFromLine, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { RepoStatus } from '../../types';

export interface CommitModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRepos: string[];
  allRepos: RepoStatus[];
  onCommit: (message: string, push: boolean, repos?: string[]) => Promise<void>;
}

export const CommitModal: FC<CommitModalProps> = ({
  isOpen,
  onClose,
  selectedRepos,
  allRepos,
  onCommit,
}) => {
  const [message, setMessage] = useState<string>('');
  const [pushImmediately, setPushImmediately] = useState<boolean>(false);
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

  const dirtyRepos = useMemo(() => {
    return targetReposList.filter((r) => r.dirty);
  }, [targetReposList]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMsg = message.trim();
    if (!trimmedMsg) {
      setError('请输入提交信息 (Commit message)');
      return;
    }
    if (dirtyRepos.length === 0) {
      setError('当前选中的仓库均无未提交更改 (Clean)');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const repoPaths = selectedRepos.length > 0 ? selectedRepos : undefined;
      await onCommit(trimmedMsg, pushImmediately, repoPaths);
      onClose();
    } catch (err: any) {
      setError(err?.message || '批量提交失败');
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
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <GitCommit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                批量提交代码 (Commit)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                对含有未暂存/未提交变动的仓库进行批量提交
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
        <form id="commit-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Commit Message Textarea */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              提交信息 (Commit Message) <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="feat: 更新业务逻辑模块 或 fix: 修复若干已知问题..."
              rows={3}
              disabled={isLoading}
              required
              autoFocus
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-sans"
            />
          </div>

          {/* Push Immediately Checkbox */}
          <div className="pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={pushImmediately}
                onChange={(e) => setPushImmediately(e.target.checked)}
                disabled={isLoading}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
              />
              <ArrowUpFromLine className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-medium">提交后立即推送到远程仓库 (Push to remote immediately)</span>
            </label>
          </div>

          {/* Error display */}
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Dirty Status summary warning */}
          {dirtyRepos.length === 0 && targetReposList.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>目标仓库中没有检测到未提交的代码更改 (Working trees are clean)。</span>
            </div>
          )}

          {/* Affected Repositories Preview */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                涉及的仓库 ({dirtyRepos.length} 个存在更改 / 共 {targetReposList.length} 个)
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
                      {repo.dirty ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px] font-medium border border-amber-200 dark:border-amber-800">
                          存在更改
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px]">
                          干净 (Clean)
                        </span>
                      )}
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
            form="commit-form"
            disabled={isLoading || dirtyRepos.length === 0 || !message.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm transition disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>提交中...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{pushImmediately ? '提交并推送' : '确认提交'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
