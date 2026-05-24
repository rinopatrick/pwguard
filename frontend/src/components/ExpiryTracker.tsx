import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';

interface PasswordEntry {
  id: string;
  service: string;
  lastChanged: string; // ISO date
  expiryDays: number;
}

const STORAGE_KEY = 'pwguard-expiry-tracker';

function getEntries(): PasswordEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: PasswordEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function daysUntilExpiry(entry: PasswordEntry): number {
  const lastChanged = new Date(entry.lastChanged).getTime();
  const expiryDate = lastChanged + entry.expiryDays * 24 * 60 * 60 * 1000;
  return Math.ceil((expiryDate - Date.now()) / (24 * 60 * 60 * 1000));
}

export default function ExpiryTracker() {
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [service, setService] = useState('');
  const [lastChanged, setLastChanged] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDays, setExpiryDays] = useState(90);

  useEffect(() => { setEntries(getEntries()); }, []);

  const sorted = useMemo(() => {
    return [...entries].sort((a, b) => daysUntilExpiry(a) - daysUntilExpiry(b));
  }, [entries]);

  const expiredCount = sorted.filter(e => daysUntilExpiry(e) <= 0).length;
  const expiringCount = sorted.filter(e => daysUntilExpiry(e) > 0 && daysUntilExpiry(e) <= 14).length;

  const addEntry = () => {
    if (!service.trim()) return;
    const newEntry: PasswordEntry = {
      id: Date.now().toString(36),
      service: service.trim(),
      lastChanged,
      expiryDays,
    };
    const updated = [...entries, newEntry];
    saveEntries(updated);
    setEntries(updated);
    setService('');
  };

  const deleteEntry = (id: string) => {
    const updated = entries.filter(e => e.id !== id);
    saveEntries(updated);
    setEntries(updated);
  };

  const markRenewed = (id: string) => {
    const updated = entries.map(e => e.id === id ? { ...e, lastChanged: new Date().toISOString().split('T')[0] } : e);
    saveEntries(updated);
    setEntries(updated);
  };

  const getStatus = (days: number) => {
    if (days <= 0) return { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Expired', icon: '🔴' };
    if (days <= 14) return { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: `${days}d left`, icon: '🟡' };
    return { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: `${days}d left`, icon: '🟢' };
  };

  // Try browser notifications
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    // Check for expired passwords
    const expired = sorted.filter(e => daysUntilExpiry(e) <= 0);
    if (expired.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Password Expiry Alert', {
        body: `${expired.length} password(s) have expired: ${expired.map(e => e.service).join(', ')}`,
      });
    }
  }, [sorted]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Add Entry */}
      <div className="glass p-5">
        <h3 className="text-sm text-slate-500 uppercase tracking-wider mb-3">Add Password Tracker</h3>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={service}
              onChange={(e) => setService(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addEntry()}
              placeholder="Service name (e.g., Gmail, GitHub)"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-indigo-500/50"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-slate-500 block mb-1">Last Changed</label>
              <input
                type="date"
                value={lastChanged}
                onChange={(e) => setLastChanged(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-indigo-500/50"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-500 block mb-1">Expiry Period</label>
              <select
                value={expiryDays}
                onChange={(e) => setExpiryDays(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none"
              >
                <option value={30} className="bg-slate-800">30 days</option>
                <option value={60} className="bg-slate-800">60 days</option>
                <option value={90} className="bg-slate-800">90 days</option>
                <option value={180} className="bg-slate-800">180 days</option>
                <option value={365} className="bg-slate-800">365 days</option>
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={addEntry}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium">
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {entries.length > 0 && (
        <div className="glass p-5">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-red-400">{expiredCount}</p>
              <p className="text-xs text-slate-500">Expired</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-400">{expiringCount}</p>
              <p className="text-xs text-slate-500">Expiring Soon</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-400">{entries.length - expiredCount - expiringCount}</p>
              <p className="text-xs text-slate-500">Valid</p>
            </div>
          </div>
        </div>
      )}

      {/* Entries List */}
      {entries.length === 0 ? (
        <div className="glass p-8 text-center">
          <div className="text-4xl mb-3">⏰</div>
          <p className="text-slate-400 text-sm">No passwords being tracked. Add one above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(entry => {
            const days = daysUntilExpiry(entry);
            const status = getStatus(days);
            return (
              <motion.div key={entry.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className={`glass p-4 border ${status.color}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{status.icon}</span>
                    <div>
                      <p className="text-white font-medium">{entry.service}</p>
                      <p className="text-xs text-slate-500">
                        Last changed: {new Date(entry.lastChanged).toLocaleDateString()} · Expires every {entry.expiryDays} days
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${status.color.split(' ')[1]}`}>{status.label}</span>
                    <button onClick={() => markRenewed(entry.id)}
                      className="px-3 py-1 bg-white/5 rounded-lg text-xs text-slate-300 hover:text-white" title="Mark as renewed">
                      ↻
                    </button>
                    <button onClick={() => deleteEntry(entry.id)}
                      className="text-slate-500 hover:text-red-400 text-sm">✕</button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
