import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StrengthGauge from './StrengthGauge';

interface CompareResult {
  password_hidden: string;
  analysis: {
    password_length: number;
    entropy: number;
    crack_time_display: string;
    strength_percent: number;
    strength_label: string;
    breach_count: number;
    breach_checked: boolean;
    zxcvbn_score: number;
    zxcvbn_feedback: string[];
  };
}

export default function CompareTab() {
  const [passwords, setPasswords] = useState(['', '']);
  const [results, setResults] = useState<CompareResult[] | null>(null);
  const [bestIdx, setBestIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleAddField = () => {
    if (passwords.length < 3) setPasswords([...passwords, '']);
  };

  const handleRemoveField = (idx: number) => {
    if (passwords.length > 2) {
      setPasswords(passwords.filter((_, i) => i !== idx));
    }
  };

  const handleCompare = async () => {
    const validPws = passwords.filter((p) => p.length > 0);
    if (validPws.length < 2) return;

    setLoading(true);
    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passwords: validPws }),
      });
      const data = await res.json();
      setResults(data.comparisons);
      setBestIdx(data.best);
    } catch (err) {
      console.error('Compare failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const colors = ['#ef4444', '#f97316', '#eab308'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="glass p-5 border-l-4 border-purple-500">
        <p className="text-sm text-slate-300 font-medium">Password Comparison</p>
        <p className="text-xs text-slate-500 mt-1">
          Enter 2-3 passwords to compare their strength side by side. The strongest will be highlighted.
        </p>
      </div>

      {/* Password inputs */}
      <div className="space-y-3">
        {passwords.map((pw, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              type="password"
              value={pw}
              onChange={(e) => {
                const next = [...passwords];
                next[idx] = e.target.value;
                setPasswords(next);
              }}
              placeholder={`Password ${idx + 1}`}
              className="flex-1 bg-white/5 text-white font-mono px-4 py-3 rounded-xl border border-white/10 outline-none focus:border-purple-500/50 transition-colors placeholder-slate-600"
            />
            {passwords.length > 2 && (
              <button
                onClick={() => handleRemoveField(idx)}
                className="px-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {passwords.length < 3 && (
          <button
            onClick={handleAddField}
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors text-sm"
          >
            + Add Password
          </button>
        )}
        <button
          onClick={handleCompare}
          disabled={loading || passwords.filter((p) => p.length > 0).length < 2}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-shadow disabled:opacity-50"
        >
          {loading ? 'Comparing...' : 'Compare Passwords'}
        </button>
      </div>

      {/* Results */}
      <AnimatePresence>
        {results && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {/* Side-by-side gauges */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {results.map((r, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className={`glass p-4 text-center relative ${
                    i === bestIdx ? 'ring-2 ring-emerald-500/50' : ''
                  }`}
                >
                  {i === bestIdx && (
                    <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                      BEST
                    </span>
                  )}
                  <p className="text-xs text-slate-500 mb-2">Password {i + 1}</p>
                  <p className="text-xs text-slate-600 font-mono mb-3">{r.password_hidden}</p>
                  <StrengthGauge
                    percent={r.analysis.strength_percent}
                    label={r.analysis.strength_label}
                  />
                </motion.div>
              ))}
            </div>

            {/* Comparison table */}
            <div className="glass overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase">Metric</th>
                    {results.map((_, i) => (
                      <th key={i} className="text-center px-4 py-3 text-xs text-slate-500 uppercase">
                        Password {i + 1}
                        {i === bestIdx && <span className="ml-1 text-emerald-400">★</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Strength', key: 'strength_percent', fmt: (v: number) => `${v}%` },
                    { label: 'Entropy', key: 'entropy', fmt: (v: number) => `${v} bits` },
                    { label: 'Crack Time', key: 'crack_time_display', fmt: (v: unknown) => String(v) },
                    { label: 'Length', key: 'password_length', fmt: (v: number) => `${v} chars` },
                    { label: 'zxcvbn', key: 'zxcvbn_score', fmt: (v: number) => `${v}/4` },
                    { label: 'Breaches', key: 'breach_count', fmt: (v: number) => v > 0 ? `${v.toLocaleString()}x` : 'None' },
                  ].map((row) => (
                    <tr key={row.key} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 text-slate-400">{row.label}</td>
                      {results.map((r, i) => {
                        const val = r.analysis[row.key as keyof typeof r.analysis];
                        const isBest = i === bestIdx;
                        return (
                          <td
                            key={i}
                            className={`px-4 py-3 text-center font-mono ${
                              isBest ? 'text-emerald-300 font-bold' : 'text-slate-300'
                            }`}
                          >
                            {row.fmt(val as never)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
