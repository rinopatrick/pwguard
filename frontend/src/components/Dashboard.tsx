import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '../i18n';

interface HistoryEntry {
  strength_percent: number;
  strength_label: string;
  entropy: number;
  length: number;
  breach_count: number;
  timestamp: number;
}

function getHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem('pwguard-history') || '[]');
  } catch {
    return [];
  }
}

export default function Dashboard() {
  const { t } = useI18n();
  const history = useMemo(getHistory, []);

  const distribution = useMemo(() => {
    const bins = { weak: 0, fair: 0, strong: 0, veryStrong: 0 };
    history.forEach((e) => {
      if (e.strength_percent < 40) bins.weak++;
      else if (e.strength_percent < 60) bins.fair++;
      else if (e.strength_percent < 80) bins.strong++;
      else bins.veryStrong++;
    });
    return bins;
  }, [history]);

  const avgEntropy = useMemo(() => {
    if (history.length === 0) return 0;
    return Math.round((history.reduce((sum, e) => sum + e.entropy, 0) / history.length) * 10) / 10;
  }, [history]);

  const breachRate = useMemo(() => {
    if (history.length === 0) return 0;
    const breached = history.filter((e) => e.breach_count > 0).length;
    return Math.round((breached / history.length) * 100);
  }, [history]);

  if (history.length === 0) {
    return (
      <div className="glass p-10 text-center">
        <p className="text-slate-400">{t('dashboard.noData')}</p>
      </div>
    );
  }

  const maxDist = Math.max(distribution.weak, distribution.fair, distribution.strong, distribution.veryStrong, 1);

  return (
    <div className="space-y-6">
      {/* Distribution */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass p-5">
        <h3 className="text-sm font-semibold text-white mb-4">{t('dashboard.distribution')}</h3>
        <div className="flex items-end gap-3 h-32">
          {[
            { label: t('strength.weak'), value: distribution.weak, color: '#ef4444' },
            { label: t('strength.fair'), value: distribution.fair, color: '#eab308' },
            { label: t('strength.strong'), value: distribution.strong, color: '#10b981' },
            { label: t('strength.veryStrong'), value: distribution.veryStrong, color: '#059669' },
          ].map((b) => (
            <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-slate-400">{b.value}</span>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(b.value / maxDist) * 100}%` }}
                className="w-full rounded-t-lg min-h-[4px]"
                style={{ backgroundColor: b.color }}
              />
              <span className="text-xs text-slate-500">{b.label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass p-4 text-center">
          <p className="text-2xl font-bold text-indigo-400">{avgEntropy}</p>
          <p className="text-xs text-slate-500">{t('dashboard.avgEntropy')} (bits)</p>
        </div>
        <div className="glass p-4 text-center">
          <p className="text-2xl font-bold text-white">{history.length}</p>
          <p className="text-xs text-slate-500">Total Analyzed</p>
        </div>
        <div className="glass p-4 text-center">
          <p className="text-2xl font-bold" style={{ color: breachRate > 30 ? '#ef4444' : '#10b981' }}>
            {breachRate}%
          </p>
          <p className="text-xs text-slate-500">{t('dashboard.breachRate')}</p>
        </div>
      </div>

      {/* Recent entries */}
      <div className="glass p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Recent Analyses</h3>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {history.slice(0, 10).map((e, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5">
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{
                  width: `${e.strength_percent}%`,
                  backgroundColor: e.strength_percent < 40 ? '#ef4444' : e.strength_percent < 60 ? '#eab308' : '#10b981',
                }} />
              </div>
              <span className="text-xs text-slate-500 w-10">{e.strength_percent}%</span>
              <span className="text-xs text-slate-600 w-14">{e.entropy} bits</span>
              <span className="text-xs text-slate-600 w-8">{e.length}c</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
