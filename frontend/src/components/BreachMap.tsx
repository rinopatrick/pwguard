import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Breach {
  Name: string;
  Title: string;
  Domain: string;
  BreachDate: string;
  PwnCount: number;
  DataClasses: string[];
  IsVerified: boolean;
}

// Simple world map dots (approximate lat/lon → x/y mapping)
const REGION_DOTS: { region: string; x: number; y: number }[] = [
  { region: 'North America', x: 22, y: 35 },
  { region: 'South America', x: 30, y: 60 },
  { region: 'Europe', x: 50, y: 30 },
  { region: 'Russia', x: 65, y: 25 },
  { region: 'Asia', x: 75, y: 40 },
  { region: 'Southeast Asia', x: 80, y: 55 },
  { region: 'Australia', x: 85, y: 70 },
  { region: 'Africa', x: 52, y: 55 },
  { region: 'Middle East', x: 60, y: 42 },
];

function hashToRegion(domain: string): number {
  let h = 0;
  for (let i = 0; i < domain.length; i++) h = ((h << 5) - h + domain.charCodeAt(i)) | 0;
  return Math.abs(h) % REGION_DOTS.length;
}

export default function BreachMap() {
  const [breaches, setBreaches] = useState<Breach[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Breach | null>(null);

  const fetchBreaches = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/breaches/recent');
      if (res.ok) {
        setBreaches(await res.json());
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBreaches();
    const interval = setInterval(fetchBreaches, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Map breaches to regions
  const breachDots = breaches.map((b, i) => {
    const regionIdx = hashToRegion(b.Domain || b.Name);
    const base = REGION_DOTS[regionIdx];
    // Add slight random offset
    const ox = ((i * 7) % 10) - 5;
    const oy = ((i * 13) % 10) - 5;
    return { ...b, x: base.x + ox, y: base.y + oy, key: `${b.Name}-${i}` };
  });

  const formatCount = (n: number) => {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return n.toString();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="glass p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm text-slate-500 uppercase tracking-wider">Real-time Breach Map</h3>
          <button onClick={fetchBreaches} className="text-xs text-indigo-400 hover:text-indigo-300">
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <div className="h-60 flex items-center justify-center">
            <div className="animate-pulse text-slate-500">Loading breach data...</div>
          </div>
        ) : (
          <div className="relative h-60 bg-slate-900/50 rounded-xl overflow-hidden">
            {/* Simple SVG map outline */}
            <svg viewBox="0 0 100 80" className="w-full h-full">
              {/* Continents (simplified outlines) */}
              <path d="M15,20 Q20,15 25,18 L30,25 Q28,35 20,38 L15,30 Z" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.3" />
              <path d="M42,18 Q55,12 65,15 L68,22 Q60,28 50,30 L42,25 Z" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.3" />
              <path d="M55,30 Q65,28 78,32 L85,45 Q80,55 70,58 L60,50 Q55,40 55,30 Z" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.3" />
              <path d="M80,60 Q85,55 90,60 L88,70 Q85,75 80,72 Z" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.3" />

              {/* Breach dots */}
              {breachDots.map((dot, i) => (
                <motion.circle
                  key={dot.key}
                  cx={dot.x}
                  cy={dot.y}
                  r={Math.max(1, Math.min(3, Math.log10(Math.max(dot.PwnCount, 10)) * 0.5))}
                  fill={dot.IsVerified ? '#ef4444' : '#f97316'}
                  opacity={0.8}
                  initial={{ r: 0, opacity: 0 }}
                  animate={{ r: Math.max(1, Math.min(3, Math.log10(Math.max(dot.PwnCount, 10)) * 0.5)), opacity: 0.8 }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                  className="cursor-pointer"
                  onClick={() => setSelected(dot)}
                />
              ))}
            </svg>
          </div>
        )}
      </div>

      {/* Selected breach detail */}
      {selected && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-5"
        >
          <div className="flex justify-between items-start">
            <div>
              <h4 className="text-white font-bold">{selected.Title}</h4>
              <p className="text-xs text-slate-500">{selected.Domain} · {selected.BreachDate}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-white">✕</button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-500">Accounts Affected</p>
              <p className="text-lg font-bold text-red-400">{formatCount(selected.PwnCount)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Verified</p>
              <p className="text-lg font-bold">{selected.IsVerified ? '✅ Yes' : '⚠️ Unverified'}</p>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-xs text-slate-500 mb-1">Data Exposed:</p>
            <div className="flex flex-wrap gap-1">
              {selected.DataClasses.map((dc, i) => (
                <span key={i} className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-300">{dc}</span>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Breach list */}
      <div className="glass p-5">
        <h3 className="text-sm text-slate-500 uppercase tracking-wider mb-3">Recent Breaches ({breaches.length})</h3>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {breaches.slice(0, 20).map((b, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div>
                <p className="text-sm text-white">{b.Title}</p>
                <p className="text-xs text-slate-500">{b.Domain} · {b.BreachDate}</p>
              </div>
              <span className="text-xs text-red-400 font-mono">{formatCount(b.PwnCount)}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
