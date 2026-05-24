import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '../i18n';

interface BulkResult {
  password_hidden: string;
  analysis: {
    strength_percent: number;
    strength_label: string;
    entropy: number;
    breach_count: number;
    zxcvbn_score: number;
    policy_compliant: boolean;
  };
}

interface BulkSummary {
  total: number;
  weak_count: number;
  strong_count: number;
  breached_count: number;
  avg_entropy: number;
}

export default function BulkCheck() {
  const { t } = useI18n();
  const [results, setResults] = useState<BulkResult[]>([]);
  const [summary, setSummary] = useState<BulkSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const getStrengthColor = (pct: number) => {
    if (pct < 25) return '#ef4444';
    if (pct < 50) return '#f97316';
    if (pct < 75) return '#eab308';
    return '#10b981';
  };

  const handleAnalyze = useCallback(async () => {
    const passwords = input.split('\n').map(s => s.trim()).filter(Boolean);
    if (passwords.length === 0) return;

    setLoading(true);
    try {
      const res = await fetch('/api/analyze-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passwords }),
      });
      const data = await res.json();
      setResults(data.results);
      setSummary(data.summary);
    } catch {
      console.error('Bulk analysis failed');
    } finally {
      setLoading(false);
    }
  }, [input]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        setInput(text);
      };
      reader.readAsText(file);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setInput(ev.target?.result as string);
      };
      reader.readAsText(file);
    }
  }, []);

  const handleExport = useCallback(() => {
    if (results.length === 0) return;
    const csv = [
      'password_masked,strength_percent,strength_label,entropy,breach_count,zxcvbn_score',
      ...results.map(r =>
        `${r.password_hidden},${r.analysis.strength_percent},${r.analysis.strength_label},${r.analysis.entropy},${r.analysis.breach_count},${r.analysis.zxcvbn_score}`
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pwguard-bulk-results.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);

  return (
    <div className="space-y-6">
      <div className="glass p-5">
        <h2 className="text-lg font-bold text-white mb-4">{t('bulk.title')}</h2>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            dragOver ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 hover:border-white/20'
          }`}
        >
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileSelect} />
          <p className="text-slate-400 text-sm">{t('bulk.dropHere')}</p>
          <p className="text-slate-600 text-xs mt-1">{t('bulk.orClick')}</p>
        </div>

        {/* Text input */}
        <div className="mt-4">
          <p className="text-xs text-slate-500 mb-2">{t('bulk.pasteHere')}</p>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={6}
            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white font-mono resize-none outline-none focus:border-indigo-500/50"
            placeholder="password1&#10;P@ssw0rd123&#10;correcthorsebatterystaple"
          />
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleAnalyze}
          disabled={loading || !input.trim()}
          className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold disabled:opacity-50"
        >
          {loading ? t('bulk.analyzing') : t('bulk.analyze')}
        </motion.button>
      </div>

      {/* Summary */}
      {summary && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-5 gap-3">
          {[
            { label: t('bulk.total'), value: summary.total, color: '#818cf8' },
            { label: t('bulk.weak'), value: summary.weak_count, color: '#ef4444' },
            { label: t('bulk.strong'), value: summary.strong_count, color: '#10b981' },
            { label: t('bulk.breached'), value: summary.breached_count, color: '#f97316' },
            { label: t('bulk.avgEntropy'), value: summary.avg_entropy, color: '#eab308' },
          ].map((s) => (
            <div key={s.label} className="glass p-3 text-center">
              <p className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="glass p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-white">{t('bulk.title')}</h3>
            <button onClick={handleExport} className="text-xs text-indigo-400 hover:text-indigo-300">
              {t('bulk.export')}
            </button>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/5">
                <span className="font-mono text-sm text-slate-300 w-32 truncate">{r.password_hidden}</span>
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${r.analysis.strength_percent}%`,
                    backgroundColor: getStrengthColor(r.analysis.strength_percent),
                  }} />
                </div>
                <span className="text-xs font-medium w-16 text-right" style={{
                  color: getStrengthColor(r.analysis.strength_percent),
                }}>
                  {r.analysis.strength_percent}%
                </span>
                <span className="text-xs text-slate-500 w-12 text-center">
                  {r.analysis.zxcvbn_score}/4
                </span>
                {r.analysis.breach_count > 0 && (
                  <span className="text-xs text-red-400">🔴</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
