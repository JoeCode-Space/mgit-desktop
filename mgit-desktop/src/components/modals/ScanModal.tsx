import { useState, type FC } from 'react';
import {
  Search,
  X,
  Loader2,
  FolderGit2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Save,
  FolderSearch,
  FolderOpen,
} from 'lucide-react';
import type { ScanSummary } from '../../types';

export interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWorkspace: string;
  onScan: (dir: string) => Promise<ScanSummary>;
  onApplyConfig: (modules: Record<string, string[]>) => Promise<void>;
  onPickDirectory?: (defaultPath?: string) => Promise<string | null>;
}

export const ScanModal: FC<ScanModalProps> = ({
  isOpen,
  onClose,
  currentWorkspace,
  onScan,
  onApplyConfig,
  onPickDirectory,
}) => {
  const [scanDir, setScanDir] = useState<string>(currentWorkspace);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanSummary | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const handleStartScan = async () => {
    if (!scanDir.trim()) {
      setError('请输入有效的扫描目录路径');
      return;
    }
    setError(null);
    setIsScanning(true);
    try {
      const summary = await onScan(scanDir.trim());
      setScanResult(summary);
      // Default all modules to expanded
      const initialExpanded: Record<string, boolean> = {};
      Object.keys(summary.modules || {}).forEach((mod) => {
        initialExpanded[mod] = true;
      });
      setExpandedModules(initialExpanded);
    } catch (err: any) {
      setError(err?.message || '扫描工作区失败，请检查路径');
    } finally {
      setIsScanning(false);
    }
  };

  const toggleModule = (moduleName: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleName]: !prev[moduleName],
    }));
  };

  const handleApply = async () => {
    if (!scanResult) return;
    setIsSaving(true);
    setError(null);
    try {
      await onApplyConfig(scanResult.modules);
      onClose();
    } catch (err: any) {
      setError(err?.message || '保存配置失败');
    } finally {
      setIsSaving(false);
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
              <FolderSearch className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                扫描工作区 (Scan Workspace)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                递归扫描目录下的 Git 仓库并生成模块配置
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
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-slate-700 dark:text-slate-300">
          {/* Scan path input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              扫描目标根目录
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={scanDir}
                onChange={(e) => setScanDir(e.target.value)}
                placeholder="例如: /Users/username/workspace"
                disabled={isScanning || isSaving}
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 font-mono"
              />
              {onPickDirectory && (
                <button
                  type="button"
                  onClick={async () => {
                    const picked = await onPickDirectory(scanDir || currentWorkspace);
                    if (picked) setScanDir(picked);
                  }}
                  disabled={isScanning || isSaving}
                  title="浏览并选择系统文件夹"
                  className="flex items-center gap-1 px-2.5 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition shrink-0"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>浏览...</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleStartScan}
                disabled={isScanning || isSaving}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition disabled:opacity-50 shrink-0"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>扫描中...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>开始扫描</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              mgit 将扫描当前目录下包含 .git 的子项目，并自动按子目录归类模块。
            </p>
          </div>

          {/* Error notice */}
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Scan Result */}
          {scanResult && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    扫描完成：找到 {scanResult.total_repos} 个仓库，归入 {scanResult.total_modules} 个模块
                  </span>
                </div>
              </div>

              {/* Modules breakdown */}
              <div className="space-y-2">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  发现的模块与仓库结构：
                </span>
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-950/40 max-h-56 overflow-y-auto">
                  {Object.entries(scanResult.modules).map(([moduleName, repoPaths]) => {
                    const isExpanded = !!expandedModules[moduleName];
                    return (
                      <div key={moduleName} className="p-2.5">
                        <button
                          type="button"
                          onClick={() => toggleModule(moduleName)}
                          className="w-full flex items-center justify-between text-left hover:text-blue-600 dark:hover:text-blue-400 transition"
                        >
                          <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                            )}
                            <FolderGit2 className="w-3.5 h-3.5 text-blue-500" />
                            <span>{moduleName}</span>
                          </div>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {repoPaths.length} 个仓库
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="mt-2 ml-5 space-y-1 pl-2 border-l border-slate-200 dark:border-slate-800">
                            {repoPaths.map((repoPath) => (
                              <div
                                key={repoPath}
                                className="font-mono text-[11px] text-slate-600 dark:text-slate-400 truncate"
                                title={repoPath}
                              >
                                {repoPath}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <button
            type="button"
            onClick={onClose}
            disabled={isScanning || isSaving}
            className="px-4 py-2 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isScanning || isSaving || !scanResult}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm transition disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>保存中...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>保存并应用到 mgit.yaml</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
