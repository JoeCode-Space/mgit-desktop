import { useState, useEffect, useRef, type FC } from 'react';
import {
  Terminal,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
  ArrowDownCircle,
} from 'lucide-react';
import type { LogEvent } from '../types';

export interface LogDrawerProps {
  logs: LogEvent[];
  isOpen: boolean;
  onToggleOpen: () => void;
  onClearLogs: () => void;
  operationStatus?: string | null;
  loading?: boolean;
}

export const LogDrawer: FC<LogDrawerProps> = ({
  logs,
  isOpen,
  onToggleOpen,
  onClearLogs,
  operationStatus,
  loading = false,
}) => {
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Format timestamp safely
  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toTimeString().split(' ')[0] || isoString;
    } catch {
      return isoString;
    }
  };

  // Auto-scroll to bottom on new logs if enabled
  useEffect(() => {
    if (isOpen && autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen, autoScroll]);

  const latestLog = logs.length > 0 ? logs[logs.length - 1] : null;

  return (
    <aside
      aria-label="操作控制台"
      className="border-t border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-200 flex flex-col shrink-0 shadow-lg select-none transition-all duration-200 ease-in-out"
    >
      {/* Drawer Header Bar */}
      <div
        onClick={onToggleOpen}
        className="flex items-center justify-between px-4 py-2 bg-slate-800/90 hover:bg-slate-800 border-b border-slate-700/60 cursor-pointer transition select-none"
      >
        {/* Left: Terminal Icon, Title & Status Preview */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold text-xs shrink-0">
            <Terminal className="w-3.5 h-3.5 text-blue-400" />
            <span>执行日志</span>
          </div>

          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-700/80 text-slate-300 border border-slate-600/50 shrink-0">
            {logs.length} 条
          </span>

          {/* Operation Status / Latest Log snippet */}
          <div className="flex items-center gap-2 min-w-0 ml-2">
            {loading ? (
              <div className="flex items-center gap-1.5 text-blue-400 text-xs truncate">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span className="truncate">{operationStatus || '正在执行后台操作...'}</span>
              </div>
            ) : !isOpen && latestLog ? (
              <div className="flex items-center gap-1.5 text-slate-400 text-xs truncate font-mono">
                <span className="text-slate-500 hidden sm:inline">[{formatTime(latestLog.timestamp)}]</span>
                {latestLog.repo && (
                  <span className="text-blue-400 shrink-0">[{latestLog.repo}]</span>
                )}
                <span className="truncate">{latestLog.message}</span>
              </div>
            ) : !isOpen ? (
              <span className="text-xs text-slate-500 italic hidden sm:inline">
                控制台就绪，点击展开查看详细输出
              </span>
            ) : null}
          </div>
        </div>

        {/* Right: Controls (Clear, AutoScroll, Toggle) */}
        <div
          className="flex items-center gap-2 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {isOpen && (
            <>
              {/* Auto Scroll Checkbox */}
              <label
                className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer select-none pr-1"
                title="收到新日志时自动滚动至底部"
              >
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                />
                <ArrowDownCircle className="w-3 h-3 hidden sm:inline" />
                <span>自动滚动</span>
              </label>

              {/* Clear Logs Button */}
              <button
                onClick={onClearLogs}
                disabled={logs.length === 0}
                title="清空所有控制台日志"
                className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition disabled:opacity-40 disabled:pointer-events-none"
              >
                <Trash2 className="w-3 h-3" />
                <span className="hidden sm:inline">清空</span>
              </button>
            </>
          )}

          {/* Toggle Expand/Collapse */}
          <button
            onClick={onToggleOpen}
            title={isOpen ? '收起日志控制台' : '展开日志控制台'}
            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
          >
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Logs Console Body */}
      {isOpen && (
        <div
          ref={logContainerRef}
          className="h-60 bg-slate-950 text-slate-300 font-mono text-[11px] leading-relaxed p-3 overflow-y-auto select-text scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent"
        >
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-1 select-none">
              <Terminal className="w-8 h-8 opacity-40 mb-1" />
              <p>控制台空闲，暂无执行日志记录</p>
              <p className="text-[10px] text-slate-700">执行扫描、拉取、推送等操作时将在此实时显示</p>
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log, idx) => {
                let levelStyle = 'text-slate-300';
                let IconComponent = Info;

                if (log.level === 'success') {
                  levelStyle = 'text-emerald-400';
                  IconComponent = CheckCircle2;
                } else if (log.level === 'warn') {
                  levelStyle = 'text-amber-400';
                  IconComponent = AlertTriangle;
                } else if (log.level === 'error') {
                  levelStyle = 'text-rose-400';
                  IconComponent = AlertCircle;
                } else if (log.level === 'info') {
                  levelStyle = 'text-cyan-400';
                  IconComponent = Info;
                }

                return (
                  <div
                    key={`${log.timestamp}-${idx}`}
                    className="flex items-start gap-2 hover:bg-slate-900/60 px-1.5 py-0.5 rounded transition-colors"
                  >
                    {/* Timestamp */}
                    <span className="text-slate-500 shrink-0 select-none">
                      [{formatTime(log.timestamp)}]
                    </span>

                    {/* Level Icon */}
                    <span className={`shrink-0 pt-0.5 ${levelStyle}`}>
                      <IconComponent className="w-3 h-3" />
                    </span>

                    {/* Repo Name Tag if applicable */}
                    {log.repo && (
                      <span className="text-blue-400 font-medium shrink-0">
                        [{log.repo}]
                      </span>
                    )}

                    {/* Log Message */}
                    <span className={`flex-1 break-all whitespace-pre-wrap ${levelStyle}`}>
                      {log.message}
                    </span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

export default LogDrawer;
