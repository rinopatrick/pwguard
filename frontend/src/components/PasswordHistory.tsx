import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface HistoryEntry {
  id: string;
  strength_percent: number;
  strength_label: string;
  timestamp: number;
  entropy: number;
  length: number;
  breach_count: number;
}

function getStrengthColor(p: number): string {
  if (p < 25) return '#ef4444';
  if (p < 50) return '#f97316';
  if (p < 75) return '#eab308';
  return '#10b981';
}

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export function addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>) {
  const raw = localStorage.getItem('pw_history');
  const history: HistoryEntry[] = raw ? JSON.parse(raw) : [];
  history.unshift({
    ...entry,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  });
  if (history.length > 20) history.pop();
  localStorage.setItem('pw_history', JSON.stringify(history));
}

export default function PasswordHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [compareMode, setCompareMode] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('pw_history');
    if (raw) setHistory(JSON.parse(raw));
  }, []);

  const handleClear = () => {
    localStorage.removeItem('pw_history');
    setHistory([]);
    setCompareIds(new Set());
    setCompareMode(false);
  };

  const toggleCompare = (id: string) => {
    const next = new Set(compareIds);
    if (next.has(id)) {
      next.delete(id);
    } else if (next.size < 3) {
      next.add(id);
    }
    setCompareIds(next);
  };

  const compareEntries = history.filter((h) => compareIds.has(h.id));

  if (history.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass p-10 text-center"
      >
        <span className="text-4xl block mb-4">📊</span>
        <p className="text-slate-400">No analysis history yet</p>
        <p className="text-xs text-slate-600 mt-2">Analyzed passwords will appear here (without storing the actual password)</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Controls */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{history.length} analyses</span>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setCompareMode(!compareMode);
              if (compareMode) setCompareIds(new Set());
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              compareMode
                ? 'bg-indigo-500/20 border border-indigo-500/50 text-indigo-300'
                : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            {compareMode ? 'Cancel Compare' : 'Compare'}
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Compare panel */}
      <AnimatePresence>
        {compareMode && compareEntries.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass p-5 space-y-4"
          >
            <p className="text-xs text-slate-500 uppercase tracking-wider">Side-by-Side Comparison</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {compareEntries.map((entry, i) => (
                <div key={entry.id} className="space-y-2">
                  <p className="text-xs text-slate-500">#{i + 1}</p>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${entry.strength_percent}%`,
                        backgroundColor: getStrengthColor(entry.strength_percent),
                      }}
                    />
                  </div>
                  <p className="text-sm font-bold" style={{ color: getStrengthColor(entry.strength_percent) }}>
                    {entry.strength_percent}%
                  </p>
                  <p className="text-xs text-slate-400">{entry.strength_label}</p>
                  <p className="text-xs text-slate-500">{entry.entropy} bits · {entry.length} chars</p>
                  {entry.breach_count > 0 && (
                    <p className="text-xs text-red-400">Breach: {entry.breach_count.toLocaleString()}x</p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History list */}
      <div className="space-y-2">
        {history.map((entry) => (
          <motion.div
            key={entry.id}
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`glass p-4 flex items-center gap-4 cursor-pointer transition-all ${
              compareIds.has(entry.id) ? 'border-indigo-500/50 bg-indigo-500/5' : ''
            }`}
            onClick={() => compareMode && toggleCompare(entry.id)}
          >
            {compareMode && (
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                compareIds.has(entry.id) ? 'bg-indigo-500 border-indigo-500' : 'border-white/20'
              }`}>
                {compareIds.has(entry.id) && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            )}

            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ color: getStrengthColor(entry.strength_percent), backgroundColor: `${getStrengthColor(entry.strength_percent)}20` }}
            >
              {entry.strength_percent}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{entry.strength_label}</span>
                {entry.breach_count > 0 && (
                  <span className="text-xs text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">BREACHED</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                <span>{entry.entropy} bits</span>
                <span>·</span>
                <span>{entry.length} chars</span>
                <span>·</span>
                <span>{timeAgo(entry.timestamp)}</span>
              </div>
            </div>

            <div className="w-24 h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${entry.strength_percent}%`,
                  backgroundColor: getStrengthColor(entry.strength_percent),
                }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
