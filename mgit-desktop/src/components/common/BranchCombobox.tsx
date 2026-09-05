import { useState, useEffect, useRef, useMemo, type FC, type ReactNode, type KeyboardEvent } from 'react';
import { GitBranch, Globe, Plus, Loader2, ChevronDown, Check } from 'lucide-react';
import { useMgit } from '../../hooks/useMgit';
import type { BranchSummary } from '../../types';

export interface BranchComboboxProps {
  value: string;
  onChange: (value: string) => void;
  repos?: string[];
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  required?: boolean;
  className?: string;
  icon?: ReactNode;
}

interface FlatItem {
  id: string;
  type: 'local' | 'remote' | 'custom';
  value: string;
}

export const BranchCombobox: FC<BranchComboboxProps> = ({
  value,
  onChange,
  repos,
  placeholder = '输入或选择分支...',
  disabled = false,
  autoFocus = false,
  required = false,
  className = '',
  icon,
}) => {
  const { getBranches } = useMgit();
  const [branches, setBranches] = useState<BranchSummary>({ local: [], remote: [] });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [highlightIndex, setHighlightIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 稳定 repos 依赖，避免父组件传递新数组引用导致无限重新获取
  const reposKey = repos && repos.length > 0 ? repos.slice().sort().join(',') : '__all__';

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const targetRepos = repos && repos.length > 0 ? repos : undefined;
    getBranches(targetRepos)
      .then((summary) => {
        if (isMounted) {
          setBranches(summary || { local: [], remote: [] });
        }
      })
      .catch((err) => {
        console.error('获取分支列表失败:', err);
        if (isMounted) {
          setBranches({ local: [], remote: [] });
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [getBranches, reposKey]);

  // 点击组件外部自动关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const trimmedValue = value.trim();
  const query = trimmedValue.toLowerCase();

  // 根据当前输入内容模糊过滤本地分支
  const filteredLocal = useMemo(() => {
    if (!query) return branches.local;
    return branches.local.filter((b) => b.toLowerCase().includes(query));
  }, [branches.local, query]);

  // 根据当前输入内容模糊过滤远程分支
  const filteredRemote = useMemo(() => {
    if (!query) return branches.remote;
    return branches.remote.filter((b) => b.toLowerCase().includes(query));
  }, [branches.remote, query]);

  // 是否展示“使用自定义分支”
  const showCustom = useMemo(() => {
    if (!trimmedValue) return false;
    const inLocal = branches.local.some((b) => b.toLowerCase() === query);
    const inRemote = branches.remote.some((b) => b.toLowerCase() === query);
    return !inLocal && !inRemote;
  }, [trimmedValue, query, branches.local, branches.remote]);

  // 构建用于键盘导航的平铺选项列表
  const flatItems = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = [];
    for (const b of filteredLocal) {
      items.push({ id: `local-${b}`, type: 'local', value: b });
    }
    for (const b of filteredRemote) {
      items.push({ id: `remote-${b}`, type: 'remote', value: b });
    }
    if (showCustom) {
      items.push({ id: `custom-${trimmedValue}`, type: 'custom', value: trimmedValue });
    }
    return items;
  }, [filteredLocal, filteredRemote, showCustom, trimmedValue]);

  // 当搜索查询变化时，重置高亮索引为 0 确保首项聚焦
  useEffect(() => {
    if (flatItems.length > 0) {
      setHighlightIndex(0);
    } else {
      setHighlightIndex(-1);
    }
  }, [query]);

  // 当选项列表长度发生变化时确保高亮索引有效
  useEffect(() => {
    if (flatItems.length > 0) {
      setHighlightIndex((prev) => (prev >= 0 && prev < flatItems.length ? prev : 0));
    } else {
      setHighlightIndex(-1);
    }
  }, [flatItems.length]);

  // 高亮项随上下键滚动保持在可视区域
  useEffect(() => {
    if (isOpen && listRef.current && highlightIndex >= 0) {
      const activeEl = listRef.current.querySelector<HTMLElement>('[data-highlighted="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightIndex, isOpen]);

  const handleSelect = (branchName: string) => {
    onChange(branchName);
    setIsOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (flatItems.length > 0) {
        setHighlightIndex((prev) => (prev + 1) % flatItems.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (flatItems.length > 0) {
        setHighlightIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length);
      }
    } else if (e.key === 'Enter') {
      if (isOpen && highlightIndex >= 0 && highlightIndex < flatItems.length) {
        e.preventDefault();
        handleSelect(flatItems[highlightIndex].value);
      }
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    } else if (e.key === 'Tab') {
      if (isOpen) {
        setIsOpen(false);
      }
    }
  };

  const localStartIndex = 0;
  const remoteStartIndex = filteredLocal.length;
  const customIndex = filteredLocal.length + filteredRemote.length;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* 输入框区域 */}
      <div className="relative flex items-center">
        <div className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none flex items-center justify-center">
          {icon ? icon : <GitBranch className="w-3.5 h-3.5" />}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) {
              setIsOpen(true);
            }
          }}
          onFocus={() => {
            if (!disabled) {
              setIsOpen(true);
            }
          }}
          onClick={() => {
            if (!disabled && !isOpen) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          required={required}
          className="w-full pl-8 pr-8 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono transition disabled:opacity-50 disabled:cursor-not-allowed"
        />

        <div
          className="absolute right-2 top-2.5 flex items-center gap-1 text-slate-400 cursor-pointer"
          onClick={() => {
            if (!disabled) {
              setIsOpen(!isOpen);
              inputRef.current?.focus();
            }
          }}
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
          ) : (
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-blue-500' : ''
              }`}
            />
          )}
        </div>
      </div>

      {/* 下拉浮层 */}
      {isOpen && !disabled && (
        <div
          ref={listRef}
          className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-60 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1 text-xs divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in zoom-in-95"
        >
          {/* 加载提示 */}
          {isLoading && flatItems.length === 0 && (
            <div className="p-3 text-center text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
              <span>正在获取分支列表...</span>
            </div>
          )}

          {/* 无匹配分支 */}
          {!isLoading && flatItems.length === 0 && (
            <div className="p-3 text-center text-slate-400">
              无匹配分支
            </div>
          )}

          {/* 本地分支分组 */}
          {filteredLocal.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase bg-slate-50 dark:bg-slate-950/50 flex items-center gap-1.5 select-none">
                <GitBranch className="w-3 h-3 text-blue-500" />
                <span>本地分支 (Local)</span>
                <span className="ml-auto text-[10px] text-slate-400 font-normal">
                  {filteredLocal.length}
                </span>
              </div>
              <div className="py-0.5">
                {filteredLocal.map((branch, idx) => {
                  const globalIdx = localStartIndex + idx;
                  const isHighlighted = highlightIndex === globalIdx;
                  const isSelected = value === branch;
                  return (
                    <button
                      key={`local-${branch}`}
                      type="button"
                      data-highlighted={isHighlighted ? 'true' : undefined}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setHighlightIndex(globalIdx)}
                      onClick={() => handleSelect(branch)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-left font-mono text-xs transition-colors ${
                        isHighlighted
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      } ${isSelected ? 'font-semibold text-blue-600 dark:text-blue-400' : ''}`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <GitBranch className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        <span className="truncate">{branch}</span>
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 远程分支分组 */}
          {filteredRemote.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase bg-slate-50 dark:bg-slate-950/50 flex items-center gap-1.5 select-none">
                <Globe className="w-3 h-3 text-emerald-500" />
                <span>远程分支 (Remote)</span>
                <span className="ml-auto text-[10px] text-slate-400 font-normal">
                  {filteredRemote.length}
                </span>
              </div>
              <div className="py-0.5">
                {filteredRemote.map((branch, idx) => {
                  const globalIdx = remoteStartIndex + idx;
                  const isHighlighted = highlightIndex === globalIdx;
                  const isSelected = value === branch;
                  return (
                    <button
                      key={`remote-${branch}`}
                      type="button"
                      data-highlighted={isHighlighted ? 'true' : undefined}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setHighlightIndex(globalIdx)}
                      onClick={() => handleSelect(branch)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-left font-mono text-xs transition-colors ${
                        isHighlighted
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      } ${isSelected ? 'font-semibold text-blue-600 dark:text-blue-400' : ''}`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Globe className="w-3.5 h-3.5 shrink-0 opacity-70 text-slate-400" />
                        <span className="truncate">{branch}</span>
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 自定义分支选项 */}
          {showCustom && (
            <div className="p-1">
              <button
                type="button"
                data-highlighted={highlightIndex === customIndex ? 'true' : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlightIndex(customIndex)}
                onClick={() => handleSelect(trimmedValue)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left rounded-md font-mono text-xs transition-colors ${
                  highlightIndex === customIndex
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-blue-600 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Plus className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                <span className="truncate">
                  使用自定义分支: <strong className="font-semibold">{trimmedValue}</strong>
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BranchCombobox;
