import { useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  onGenerate: (password: string, entropy: number, strengthLabel: string, strengthPercent: number) => void;
}

export default function PasswordGenerator({ onGenerate }: Props) {
  const [length, setLength] = useState(16);
  const [upper, setUpper] = useState(true);
  const [lower, setLower] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [generated, setGenerated] = useState('');
  const [showGenerated, setShowGenerated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [strengthPercent, setStrengthPercent] = useState(0);
  const [strengthLabel, setStrengthLabel] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          length,
          include_uppercase: upper,
          include_lowercase: lower,
          include_digits: digits,
          include_symbols: symbols,
        }),
      });
      const data = await res.json();
      setGenerated(data.password);
      setStrengthPercent(data.strength_percent);
      setStrengthLabel(data.strength_label);
      setShowGenerated(true);
      onGenerate(data.password, data.entropy, data.strength_label, data.strength_percent);
    } catch (err) {
      console.error('Generate failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStrengthColor = (p: number) => {
    if (p < 25) return '#ef4444';
    if (p < 50) return '#f97316';
    if (p < 75) return '#eab308';
    return '#10b981';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Length slider */}
      <div className="glass p-5">
        <div className="flex justify-between mb-3">
          <span className="text-sm text-slate-400">Password Length</span>
          <span className="text-lg font-bold text-white font-mono">{length}</span>
        </div>
        <input
          type="range"
          min={8}
          max={64}
          value={length}
          onChange={(e) => setLength(Number(e.target.value))}
          className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
        <div className="flex justify-between text-xs text-slate-600 mt-1">
          <span>8</span>
          <span>64</span>
        </div>
      </div>

      {/* Character type toggles */}
      <div className="glass p-5 space-y-3">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Character Types</p>
        {[
          { label: 'Uppercase (A-Z)', checked: upper, set: setUpper },
          { label: 'Lowercase (a-z)', checked: lower, set: setLower },
          { label: 'Digits (0-9)', checked: digits, set: setDigits },
          { label: 'Symbols (!@#$...)', checked: symbols, set: setSymbols },
        ].map(({ label, checked, set }) => (
          <label key={label} className="flex items-center gap-3 cursor-pointer group">
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
              checked ? 'bg-indigo-500 border-indigo-500' : 'border-white/20 group-hover:border-white/40'
            }`}>
              {checked && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm text-slate-300">{label}</span>
          </label>
        ))}
      </div>

      {/* Generate button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleGenerate}
        disabled={loading || (!upper && !lower && !digits && !symbols)}
        className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-lg shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Generating...' : 'Generate Password'}
      </motion.button>

      {/* Generated password display */}
      {generated && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <input
              type={showGenerated ? 'text' : 'password'}
              value={generated}
              readOnly
              className="flex-1 bg-white/5 text-lg font-mono text-white px-4 py-3 rounded-lg border border-white/10 outline-none"
            />
            <button
              onClick={() => setShowGenerated(!showGenerated)}
              className="p-3 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              {showGenerated ? '🙈' : '👁️'}
            </button>
            <button
              onClick={handleCopy}
              className="p-3 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              {copied ? '✓' : '📋'}
            </button>
          </div>

          {/* Strength indicator */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${strengthPercent}%` }}
                transition={{ duration: 0.5 }}
                className="h-full rounded-full"
                style={{ backgroundColor: getStrengthColor(strengthPercent) }}
              />
            </div>
            <span className="text-sm font-medium" style={{ color: getStrengthColor(strengthPercent) }}>
              {strengthLabel}
            </span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
