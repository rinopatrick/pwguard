import { useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  onGenerate: (passphrase: string, entropy: number, strengthLabel: string, strengthPercent: number) => void;
}

export default function PassphraseGenerator({ onGenerate }: Props) {
  const [wordCount, setWordCount] = useState(4);
  const [separator, setSeparator] = useState('-');
  const [capitalize, setCapitalize] = useState(false);
  const [includeNumber, setIncludeNumber] = useState(false);
  const [language, setLanguage] = useState<'en' | 'id'>('en');
  const [generated, setGenerated] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [strengthPercent, setStrengthPercent] = useState(0);
  const [strengthLabel, setStrengthLabel] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/passphrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word_count: wordCount,
          separator,
          capitalize,
          include_number: includeNumber,
          language,
        }),
      });
      const data = await res.json();
      setGenerated(data.passphrase);
      setStrengthPercent(data.strength_percent);
      setStrengthLabel(data.strength_label);
      onGenerate(data.passphrase, data.entropy, data.strength_label, data.strength_percent);
    } catch (err) {
      console.error('Passphrase generation failed:', err);
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
      {/* Info card */}
      <div className="glass p-5 border-l-4 border-indigo-500">
        <p className="text-sm text-slate-300 font-medium">Why passphrases?</p>
        <p className="text-xs text-slate-500 mt-1">
          Passphrases use multiple random words, creating high entropy while being easy to remember.
          A 4-word passphrase from a 2048-word list has ~44 bits of entropy — stronger than most passwords.
        </p>
      </div>

      {/* Language selector */}
      <div className="glass p-5">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Language</p>
        <div className="flex gap-2">
          {[
            { id: 'en' as const, label: 'English', flag: '🇺🇸' },
            { id: 'id' as const, label: 'Bahasa Indonesia', flag: '🇮🇩' },
          ].map((lang) => (
            <button
              key={lang.id}
              onClick={() => setLanguage(lang.id)}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                language === lang.id
                  ? 'bg-indigo-500/20 border border-indigo-500/50 text-indigo-300'
                  : 'bg-white/5 border border-transparent text-slate-500 hover:text-white'
              }`}
            >
              <span className="mr-2">{lang.flag}</span>
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      {/* Word count slider */}
      <div className="glass p-5">
        <div className="flex justify-between mb-3">
          <span className="text-sm text-slate-400">Word Count</span>
          <span className="text-lg font-bold text-white font-mono">{wordCount}</span>
        </div>
        <input
          type="range"
          min={3}
          max={8}
          value={wordCount}
          onChange={(e) => setWordCount(Number(e.target.value))}
          className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
        <div className="flex justify-between text-xs text-slate-600 mt-1">
          <span>3</span>
          <span>8</span>
        </div>
      </div>

      {/* Options */}
      <div className="glass p-5 space-y-4">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Options</p>

        {/* Separator */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">Separator</span>
          <div className="flex gap-2">
            {['-', '.', '_', ' ', '+'].map((s) => (
              <button
                key={s}
                onClick={() => setSeparator(s)}
                className={`w-10 h-10 rounded-lg font-mono text-lg flex items-center justify-center transition-all ${
                  separator === s
                    ? 'bg-indigo-500/20 border border-indigo-500/50 text-indigo-300'
                    : 'bg-white/5 border border-white/10 text-slate-500 hover:text-white'
                }`}
              >
                {s === ' ' ? '␣' : s}
              </button>
            ))}
          </div>
        </div>

        {/* Capitalize toggle */}
        <label className="flex items-center justify-between cursor-pointer group">
          <span className="text-sm text-slate-300">Capitalize Words</span>
          <div
            className={`w-11 h-6 rounded-full relative transition-all ${
              capitalize ? 'bg-indigo-500' : 'bg-white/10'
            }`}
            onClick={() => setCapitalize(!capitalize)}
          >
            <div
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
              style={{ left: capitalize ? '22px' : '2px' }}
            />
          </div>
        </label>

        {/* Include number toggle */}
        <label className="flex items-center justify-between cursor-pointer group">
          <span className="text-sm text-slate-300">Append Number</span>
          <div
            className={`w-11 h-6 rounded-full relative transition-all ${
              includeNumber ? 'bg-indigo-500' : 'bg-white/10'
            }`}
            onClick={() => setIncludeNumber(!includeNumber)}
          >
            <div
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
              style={{ left: includeNumber ? '22px' : '2px' }}
            />
          </div>
        </label>
      </div>

      {/* Generate button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleGenerate}
        disabled={loading}
        className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-lg shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-shadow disabled:opacity-50"
      >
        {loading ? 'Generating...' : 'Generate Passphrase'}
      </motion.button>

      {/* Generated passphrase display */}
      {generated && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={generated}
              readOnly
              className="flex-1 bg-white/5 text-lg font-mono text-white px-4 py-3 rounded-lg border border-white/10 outline-none"
            />
            <button
              onClick={handleCopy}
              className="p-3 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              {copied ? '✓' : '📋'}
            </button>
          </div>

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

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>💡</span>
            <span>{wordCount} words × ~11 bits/word = ~{wordCount * 11} bits entropy</span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
