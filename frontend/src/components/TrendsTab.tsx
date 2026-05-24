import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';

interface HistoryEntry {
  strength_percent: number;
  strength_label: string;
  entropy: number;
  length: number;
  breach_count: number;
  timestamp: number;
}

const STORAGE_KEY = 'pwguard-history';

function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function TrendsTab() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const weeklyStats = useMemo(() => {
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const thisWeek = history.filter(h => now - h.timestamp < oneWeek);
    const lastWeek = history.filter(h => now - h.timestamp >= oneWeek && now - h.timestamp < 2 * oneWeek);

    const avgThis = thisWeek.length > 0 ? thisWeek.reduce((s, h) => s + h.strength_percent, 0) / thisWeek.length : 0;
    const avgLast = lastWeek.length > 0 ? lastWeek.reduce((s, h) => s + h.strength_percent, 0) / lastWeek.length : 0;
    const change = avgLast > 0 ? ((avgThis - avgLast) / avgLast * 100) : 0;

    return { avgThis: Math.round(avgThis), avgLast: Math.round(avgLast), change: Math.round(change), count: thisWeek.length };
  }, [history]);

  // Entropy trend chart (last 20 entries)
  const chartData = useMemo(() => {
    const recent = history.slice(-20);
    if (recent.length < 2) return [];
    const maxEntropy = Math.max(...recent.map(h => h.entropy), 1);
    return recent.map((h, i) => ({
      x: i,
      y: h.entropy,
      height: (h.entropy / maxEntropy) * 100,
      label: h.strength_label,
      percent: h.strength_percent,
    }));
  }, [history]);

  const getBarColor = (percent: number) => {
    if (percent < 25) return '#ef4444';
    if (percent < 50) return '#f97316';
    if (percent < 75) return '#eab308';
    return '#10b981';
  };

  if (history.length === 0) {
    return (
      <div className="glass p-10 text-center">
        <div className="text-4xl mb-4">📈</div>
        <p className="text-slate-400">No analysis history yet. Start analyzing passwords to see trends.</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Weekly Summary */}
      <div className="glass p-6">
        <h3 className="text-sm text-slate-500 uppercase tracking-wider mb-3">Weekly Summary</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-white">{weeklyStats.avgThis}%</p>
            <p className="text-xs text-slate-500">Avg Strength This Week</p>
          </div>
          <div className="text-center">
            <p className={`text-3xl font-bold ${weeklyStats.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {weeklyStats.change >= 0 ? '+' : ''}{weeklyStats.change}%
            </p>
            <p className="text-xs text-slate-500">vs Last Week</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-indigo-400">{weeklyStats.count}</p>
            <p className="text-xs text-slate-500">Passwords Analyzed</p>
          </div>
        </div>
        {weeklyStats.change > 0 && (
          <p className="text-emerald-400 text-sm mt-3 text-center">
            🎉 Your passwords got {weeklyStats.change}% stronger this week!
          </p>
        )}
      </div>

      {/* Entropy Trend Chart */}
      {chartData.length > 0 && (
        <div className="glass p-6">
          <h3 className="text-sm text-slate-500 uppercase tracking-wider mb-4">Entropy Trend (Last {chartData.length} analyses)</h3>
          <div className="flex items-end gap-1 h-40">
            {chartData.map((d, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${d.height}%` }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="flex-1 rounded-t min-w-[8px] relative group"
                style={{ backgroundColor: getBarColor(d.percent) }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {d.y.toFixed(1)} bits — {d.label}
                </div>
              </motion.div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-600">
            <span>Oldest</span>
            <span>Latest</span>
          </div>
        </div>
      )}

      {/* Strength Distribution */}
      <div className="glass p-6">
        <h3 className="text-sm text-slate-500 uppercase tracking-wider mb-4">Overall Strength Distribution</h3>
        {['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'].map(label => {
          const count = history.filter(h => h.strength_label === label).length;
          const pct = Math.round((count / history.length) * 100);
          const colors: Record<string, string> = {
            'Very Weak': '#ef4444', 'Weak': '#f97316', 'Fair': '#eab308', 'Strong': '#10b981', 'Very Strong': '#059669',
          };
          return (
            <div key={label} className="flex items-center gap-3 mb-2">
              <span className="w-20 text-xs text-slate-400 text-right">{label}</span>
              <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: colors[label] }}
                />
              </div>
              <span className="w-10 text-xs text-slate-500 text-right">{pct}%</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
