import { useState } from 'react';
import { motion } from 'framer-motion';

interface DarkWebBreach {
  name: string;
  domain: string;
  breach_date: string;
  pwn_count: number;
  data_classes: string[];
  is_verified: boolean;
}

export default function DarkWebMonitor() {
  const [domain, setDomain] = useState('');
  const [breaches, setBreaches] = useState<DarkWebBreach[]>([]);
  const [totalBreaches, setTotalBreaches] = useState(0);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleCheck = async () => {
    if (!domain.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch('/api/darkweb/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setBreaches(data.breaches);
        setTotalBreaches(data.total_breaches);
        setTotalAccounts(data.total_accounts);
      }
    } catch {} finally { setLoading(false); }
  };

  const formatCount = (n: number) => {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return n.toString();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="glass p-6">
        <h3 className="text-sm text-slate-500 uppercase tracking-wider mb-2">Dark Web Monitoring</h3>
        <p className="text-xs text-slate-400 mb-4">
          Check if a domain has been involved in known data breaches. We scan the Have I Been Pwned breach database.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
            placeholder="example.com"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-indigo-500/50"
          />
          <button
            onClick={handleCheck}
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl font-medium hover:shadow-lg transition-shadow disabled:opacity-50"
          >
            {loading ? '...' : 'Check'}
          </button>
        </div>
      </div>

      {/* Results */}
      {searched && !loading && (
        <>
          {/* Summary */}
          <div className="glass p-5">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className={`text-3xl font-bold ${totalBreaches > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {totalBreaches}
                </p>
                <p className="text-xs text-slate-500">Breaches Found</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-orange-400">{formatCount(totalAccounts)}</p>
                <p className="text-xs text-slate-500">Accounts Affected</p>
              </div>
              <div>
                <p className={`text-3xl font-bold ${totalBreaches > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {totalBreaches > 0 ? '⚠️' : '✅'}
                </p>
                <p className="text-xs text-slate-500">Status</p>
              </div>
            </div>
          </div>

          {/* Breach List */}
          {breaches.length === 0 ? (
            <div className="glass p-8 text-center">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-emerald-400 font-medium">No breaches found for this domain</p>
              <p className="text-slate-400 text-sm mt-1">This domain has not been involved in any known data breaches.</p>
            </div>
          ) : (
            <div className="glass p-5">
              <h3 className="text-sm text-slate-500 uppercase tracking-wider mb-3">Breach Details</h3>
              <div className="space-y-3">
                {breaches.map((b, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-white font-medium">{b.name}</h4>
                        <p className="text-xs text-slate-500">{b.domain} · {b.breach_date}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {b.is_verified ? (
                          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">Verified</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">Unverified</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-4">
                      <span className="text-sm text-red-400 font-bold">{formatCount(b.pwn_count)} accounts</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {b.data_classes.map((dc, j) => (
                        <span key={j} className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-300">
                          {dc}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!searched && (
        <div className="glass p-8 text-center">
          <div className="text-4xl mb-3">🕵️</div>
          <p className="text-slate-400 text-sm">Enter a domain above to check for dark web breaches</p>
        </div>
      )}
    </motion.div>
  );
}
