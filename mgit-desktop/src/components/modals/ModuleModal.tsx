import { useState, useEffect, type FC } from 'react';
import {
  Layers,
  X,
  Plus,
  Trash2,
  Save,
  Loader2,
  FolderGit2,
  AlertCircle,
  FolderPlus,
} from 'lucide-react';
import type { MgitConfig } from '../../types';

export interface ModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: MgitConfig | null;
  onSaveConfig: (config: MgitConfig) => Promise<void>;
}

export const ModuleModal: FC<ModuleModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  // Working copy of modules mapping
  const [modulesMap, setModulesMap] = useState<Record<string, string[]>>({});
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [newModuleName, setNewModuleName] = useState<string>('');
  const [newRepoPath, setNewRepoPath] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when opening modal
  useEffect(() => {
    if (isOpen && config) {
      const cloned: Record<string, string[]> = {};
      Object.entries(config.modules || {}).forEach(([mod, repos]) => {
        cloned[mod] = [...repos];
      });
      setModulesMap(cloned);
      const firstMod = Object.keys(cloned)[0] || '';
      setSelectedModule(firstMod);
      setError(null);
      setNewModuleName('');
      setNewRepoPath('');
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const moduleNames = Object.keys(modulesMap);

  // Add new module
  const handleAddModule = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newModuleName.trim();
    if (!name) return;
    if (modulesMap[name]) {
      setError(`模块 "${name}" 已存在`);
      return;
    }
    setModulesMap((prev) => ({
      ...prev,
      [name]: [],
    }));
    setSelectedModule(name);
    setNewModuleName('');
    setError(null);
  };

  // Delete module
  const handleDeleteModule = (moduleToDelete: string) => {
    setModulesMap((prev) => {
      const next = { ...prev };
      delete next[moduleToDelete];
      return next;
    });
    if (selectedModule === moduleToDelete) {
      const remaining = moduleNames.filter((m) => m !== moduleToDelete);
      setSelectedModule(remaining[0] || '');
    }
    setError(null);
  };

  // Add repository to current selected module
  const handleAddRepo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModule) return;
    const path = newRepoPath.trim();
    if (!path) return;
    const currentRepos = modulesMap[selectedModule] || [];
    if (currentRepos.includes(path)) {
      setError(`仓库路径 "${path}" 已存在于当前模块中`);
      return;
    }
    setModulesMap((prev) => ({
      ...prev,
      [selectedModule]: [...(prev[selectedModule] || []), path],
    }));
    setNewRepoPath('');
    setError(null);
  };

  // Remove repository from current selected module
  const handleRemoveRepo = (repoPath: string) => {
    if (!selectedModule) return;
    setModulesMap((prev) => ({
      ...prev,
      [selectedModule]: (prev[selectedModule] || []).filter((p) => p !== repoPath),
    }));
  };

  // Save changes
  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onSaveConfig({
        modules: modulesMap,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || '保存模块配置失败');
    } finally {
      setIsLoading(false);
    }
  };

  const currentRepos = selectedModule ? modulesMap[selectedModule] || [] : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                模块管理 (Module Management)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                配置与组织当前工作区的模块定义 (mgit.yaml)
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

        {/* Error notification */}
        {error && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-start gap-2 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Body: Two columns layout */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800 text-xs">
          {/* Left: Module List (2 cols) */}
          <div className="md:col-span-2 flex flex-col p-4 space-y-3 bg-slate-50/30 dark:bg-slate-950/20">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              模块列表 ({moduleNames.length})
            </span>

            {/* Modules scroll list */}
            <div className="flex-1 overflow-y-auto space-y-1.5 min-h-[160px] max-h-60 md:max-h-none border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-white dark:bg-slate-900/60">
              {moduleNames.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">暂无模块</div>
              ) : (
                moduleNames.map((name) => {
                  const isSelected = selectedModule === name;
                  const count = (modulesMap[name] || []).length;
                  return (
                    <div
                      key={name}
                      onClick={() => setSelectedModule(name)}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 font-medium'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FolderGit2 className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-500' : 'text-slate-400'}`} />
                        <span className="truncate">{name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          {count}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteModule(name);
                          }}
                          title={`删除模块 "${name}"`}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add Module Input */}
            <form onSubmit={handleAddModule} className="flex gap-1.5 pt-1">
              <input
                type="text"
                value={newModuleName}
                onChange={(e) => setNewModuleName(e.target.value)}
                placeholder="新模块名..."
                disabled={isLoading}
                className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={isLoading || !newModuleName.trim()}
                title="添加模块"
                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 flex items-center justify-center shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Right: Module Repositories (3 cols) */}
          <div className="md:col-span-3 flex flex-col p-4 space-y-3">
            {selectedModule ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 dark:text-slate-400">正在编辑:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs">
                      {selectedModule}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    共 {currentRepos.length} 个仓库
                  </span>
                </div>

                {/* Add Repository Path */}
                <form onSubmit={handleAddRepo} className="flex gap-1.5">
                  <input
                    type="text"
                    value={newRepoPath}
                    onChange={(e) => setNewRepoPath(e.target.value)}
                    placeholder="输入仓库相对路径，如 packages/core 或 ."
                    disabled={isLoading}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !newRepoPath.trim()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg transition disabled:opacity-50 shrink-0"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>添加</span>
                  </button>
                </form>

                {/* Repos list */}
                <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-950/40 min-h-[160px] max-h-60 md:max-h-none">
                  {currentRepos.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs">
                      该模块尚未关联任何仓库路径，请在上方添加
                    </div>
                  ) : (
                    currentRepos.map((repoPath) => (
                      <div
                        key={repoPath}
                        className="group flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-100/60 dark:hover:bg-slate-800/40"
                      >
                        <span className="font-mono text-slate-700 dark:text-slate-300 truncate mr-2" title={repoPath}>
                          {repoPath}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveRepo(repoPath)}
                          title="移出当前模块"
                          className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs p-8 text-center">
                <Layers className="w-8 h-8 mb-2 opacity-40" />
                <p>请在左侧选择或添加一个模块以管理其仓库路径</p>
              </div>
            )}
          </div>
        </div>

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
            type="button"
            onClick={handleSave}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm transition disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>保存中...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>保存更改 (Save)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
