import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';

interface ExportResult {
  name: string;
  url: string;
  username_hidden: string;
  analysis: {
    password_length: number;
    entropy: number;
    strength_percent: number;
    strength_label: string;
    breach_count: number;
    zxcvbn_score: number;
  };
}

interface Summary {
  total: number;
  weak_count: number;
  strong_count: number;
  breached_count: number;
  avg_entropy: number;
}

export default function ExportAnalyzer() {
  const [results, setResults] = useState<ExportResult[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [format, setFormat] = useState('generic');
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const analyzeFile = async (file: File) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`/api/analyze-export?format=${format}`, { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results);
        setSummary(data.summary);
      }
    } catch {} finally { setLoading(false); }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) analyzeFile(file);
  }, [format]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) analyzeFile(file);
  };

  const exportCSV = () => {
    if (!results.length) return;
    const header = 'Name,Username,Strength,Entropy,Breach Count,zxcvbn Score\n';
    const rows = results.map(r =>
      `"${r.name}","${r.username_hidden}","${r.analysis.strength_label}",${r.analysis.entropy},${r.analysis.breach_count},${r.analysis.zxcvbn_score}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'password-analysis-results.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getColor = (label: string) => {
    if (label === 'Very Weak' || label === 'Weak') return 'text-red-400';
    if (label === 'Fair') return 'text-yellow-400';
    return 'text-emerald-400';
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Upload Area */}
      <div className="glass p-6">
        <h3 className="text-sm text-slate-500 uppercase tracking-wider mb-3">Password Manager Export Analysis</h3>
        <p className="text-xs text-slate-400 mb-4">
          Upload a CSV export from your password manager to analyze all passwords at once.
        </p>

        <div className="flex gap-2 mb-4">
          <span className="text-sm text-slate-400">Format:</span>
          {['generic', 'bitwarden', '1password', 'lastpass'].map(f => (
            <button key={f} onClick={() => setFormat(f)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                format === f ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-500 hover:text-white'
              }`}>
              {f === 'generic' ? 'Generic CSV' : f === '1password' ? '1Password' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
            dragOver ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 hover:border-white/20'
          }`}>
          <div className="text-3xl mb-2">📁</div>
          <p className="text-sm text-slate-400">
            {loading ? 'Analyzing...' : 'Drop CSV file here or click to browse'}
          </p>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="glass p-5">
          <h3 className="text-sm text-slate-500 uppercase tracking-wider mb-3">Summary</h3>
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Total', value: summary.total, color: 'text-white' },
              { label: 'Weak', value: summary.weak_count, color: 'text-red-400' },
              { label: 'Strong', value: summary.strong_count, color: 'text-emerald-400' },
              { label: 'Breached', value: summary.breached_count, color: 'text-orange-400' },
              { label: 'Avg Entropy', value: summary.avg_entropy.toFixed(1), color: 'text-indigo-400' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
          <button onClick={exportCSV} className="mt-4 w-full py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-300 hover:text-white hover:bg-white/10 transition-all">
            Export Results as CSV
          </button>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <div className="glass p-5">
          <h3 className="text-sm text-slate-500 uppercase tracking-wider mb-3">Results ({results.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 text-slate-500 font-medium">Name</th>
                  <th className="text-left py-2 text-slate-500 font-medium">Username</th>
                  <th className="text-center py-2 text-slate-500 font-medium">Strength</th>
                  <th className="text-center py-2 text-slate-500 font-medium">Entropy</th>
                  <th className="text-center py-2 text-slate-500 font-medium">Breaches</th>
                  <th className="text-center py-2 text-slate-500 font-medium">zxcvbn</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 text-white">{r.name || 'Unknown'}</td>
                    <td className="py-2 text-slate-400 font-mono text-xs">{r.username_hidden}</td>
                    <td className={`py-2 text-center font-medium ${getColor(r.analysis.strength_label)}`}>
                      {r.analysis.strength_percent}%
                    </td>
                    <td className="py-2 text-center text-slate-300 font-mono">{r.analysis.entropy.toFixed(1)}</td>
                    <td className="py-2 text-center">
                      {r.analysis.breach_count > 0 ? (
                        <span className="text-red-400">⚠️ {r.analysis.breach_count.toLocaleString()}</span>
                      ) : (
                        <span className="text-emerald-400">✓</span>
                      )}
                    </td>
                    <td className="py-2 text-center text-slate-300">{r.analysis.zxcvbn_score}/4</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}
