import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '../i18n';

interface MonitorEntry {
  email: string;
  breach_count: number;
  breach_details: string[];
  last_checked: string | null;
  created_at: string;
}

export default function BreachMonitor() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [monitors, setMonitors] = useState<MonitorEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchMonitors = async () => {
    try {
      const res = await fetch('/api/monitor');
      if (res.ok) setMonitors(await res.json());
    } catch {}
  };

  useEffect(() => { fetchMonitors(); }, []);

  const handleAdd = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.status === 409) {
        setError('Email already monitored');
      } else if (res.ok) {
        setEmail('');
        fetchMonitors();
      }
    } catch {
      setError('Failed to check email');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (em: string) => {
    await fetch(`/api/monitor/${encodeURIComponent(em)}`, { method: 'DELETE' });
    fetchMonitors();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="glass p-6">
        <h2 className="text-xl font-bold text-white mb-2">Email Breach Monitoring</h2>
        <p className="text-sm text-slate-400 mb-4">
          Monitor your email addresses for data breaches. We check against Have I Been Pwned database.
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="your@email.com"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-indigo-500/50"
          />
          <button
            onClick={handleAdd}
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-shadow disabled:opacity-50"
          >
            {loading ? '...' : 'Monitor'}
          </button>
        </div>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </div>

      {monitors.length === 0 && (
        <div className="glass p-8 text-center">
          <div className="text-4xl mb-3">📧</div>
          <p className="text-slate-400 text-sm">No emails being monitored yet</p>
        </div>
      )}

      {monitors.map((m) => (
        <motion.div
          key={m.email}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass p-5"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white font-mono font-medium">{m.email}</p>
              <p className="text-xs text-slate-500 mt-1">
                Last checked: {m.last_checked ? new Date(m.last_checked).toLocaleString() : 'Never'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                m.breach_count > 0 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {m.breach_count > 0 ? `${m.breach_count} breaches` : 'Clean'}
              </span>
              <button
                onClick={() => handleDelete(m.email)}
                className="text-slate-500 hover:text-red-400 text-sm"
              >
                ✕
              </button>
            </div>
          </div>
          {m.breach_details && m.breach_details.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {m.breach_details.map((name, i) => (
                <span key={i} className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-300">
                  {name}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}
