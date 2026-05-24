import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';

interface StepProps {
  step: number;
  title: string;
  children: React.ReactNode;
  active: boolean;
}

function Step({ step, title, children, active }: StepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: step * 0.15 }}
      className={`glass p-5 border-l-4 ${active ? 'border-indigo-500' : 'border-white/10'}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
          active ? 'bg-indigo-500 text-white' : 'bg-white/10 text-slate-500'
        }`}>
          {step}
        </span>
        <h3 className={`font-medium ${active ? 'text-white' : 'text-slate-400'}`}>{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

export default function EntropyCalculator() {
  const [password, setPassword] = useState('');

  const analysis = useMemo(() => {
    if (!password) return null;

    // Charset detection
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const symbolMatch = /[^a-zA-Z0-9]/.test(password);

    let charsetSize = 0;
    const charset: { name: string; size: number; found: boolean; chars: string }[] = [
      { name: 'Lowercase (a-z)', size: 26, found: hasLower, chars: 'a-z' },
      { name: 'Uppercase (A-Z)', size: 26, found: hasUpper, chars: 'A-Z' },
      { name: 'Digits (0-9)', size: 10, found: hasDigit, chars: '0-9' },
      { name: 'Symbols (!@#$...)', size: 33, found: symbolMatch, chars: '!@#$%^&*...' },
    ];
    charset.forEach(c => { if (c.found) charsetSize += c.size; });
    charsetSize = Math.max(charsetSize, 1);

    const length = password.length;
    const rawEntropy = length * Math.log2(charsetSize);

    // Pattern detection
    const patterns: { name: string; penalty: number }[] = [];
    if (/^(.)\1+$/.test(password) && length > 1) patterns.push({ name: 'All same characters', penalty: 35 });
    if (/^[a-z]+$/.test(password)) patterns.push({ name: 'Lowercase only', penalty: 10 });
    if (/^\d+$/.test(password)) patterns.push({ name: 'Digits only', penalty: 15 });
    if (/(.)\1{2,}/.test(password)) patterns.push({ name: 'Repeated characters', penalty: 10 });

    const totalPenalty = patterns.reduce((s, p) => s + p.penalty, 0);
    const effectiveEntropy = Math.max(rawEntropy - totalPenalty, 0);

    // Crack time
    const hashesPerSec = 10_000_000_000;
    const combos = 2 ** effectiveEntropy || 1;
    const seconds = combos / hashesPerSec / 2;

    let crackTime: string;
    if (seconds < 0.001) crackTime = 'instant';
    else if (seconds < 1) crackTime = '< 1 second';
    else if (seconds < 60) crackTime = `${Math.round(seconds)} seconds`;
    else if (seconds < 3600) crackTime = `${Math.round(seconds / 60)} minutes`;
    else if (seconds < 86400) crackTime = `${Math.round(seconds / 3600)} hours`;
    else if (seconds < 31536000) crackTime = `${Math.round(seconds / 86400)} days`;
    else crackTime = `${Math.round(seconds / 31536000)} years`;

    return { charset, charsetSize, length, rawEntropy, patterns, totalPenalty, effectiveEntropy, crackTime };
  }, [password]);

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.15 } } };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
      <div className="glass p-5">
        <h3 className="text-sm text-slate-500 uppercase tracking-wider mb-3">Entropy Calculator</h3>
        <p className="text-xs text-slate-400 mb-4">
          See exactly how password entropy is calculated, step by step.
        </p>
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Type a password to see its entropy breakdown..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono placeholder-slate-500 outline-none focus:border-indigo-500/50"
        />
      </div>

      {!password && (
        <div className="glass p-8 text-center">
          <div className="text-4xl mb-3">🧮</div>
          <p className="text-slate-400 text-sm">Enter a password above to see the step-by-step entropy calculation</p>
        </div>
      )}

      {analysis && (
        <>
          <Step step={1} title="Character Set Detection" active={true}>
            <p className="text-xs text-slate-400 mb-3">We scan the password to identify which character types are used:</p>
            <div className="space-y-2">
              {analysis.charset.map(c => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className={`w-5 h-5 rounded flex items-center justify-center text-xs ${c.found ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-600'}`}>
                    {c.found ? '✓' : '✕'}
                  </span>
                  <span className={`text-sm ${c.found ? 'text-white' : 'text-slate-600'}`}>{c.name}</span>
                  <span className="text-xs text-slate-500 ml-auto">{c.size} chars</span>
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 bg-indigo-500/10 rounded-lg">
              <p className="text-sm text-indigo-300 font-mono">Charset size = {analysis.charsetSize}</p>
            </div>
          </Step>

          <Step step={2} title="Password Length" active={true}>
            <p className="text-sm text-slate-300">
              Password has <span className="text-white font-bold">{analysis.length}</span> characters
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Each character can be one of {analysis.charsetSize} possibilities
            </p>
          </Step>

          <Step step={3} title="Raw Entropy Calculation" active={true}>
            <div className="font-mono text-sm space-y-2">
              <p className="text-slate-400">Entropy = Length × log₂(CharsetSize)</p>
              <p className="text-white">Entropy = {analysis.length} × log₂({analysis.charsetSize})</p>
              <p className="text-white">Entropy = {analysis.length} × {Math.log2(analysis.charsetSize).toFixed(2)}</p>
              <div className="p-3 bg-indigo-500/10 rounded-lg mt-2">
                <p className="text-indigo-300 font-bold">Entropy = {analysis.rawEntropy.toFixed(2)} bits</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              This means there are 2^{analysis.rawEntropy.toFixed(0)} ≈ {(2 ** analysis.rawEntropy).toExponential(2)} possible combinations
            </p>
          </Step>

          {analysis.patterns.length > 0 && (
            <Step step={4} title="Pattern Penalties" active={true}>
              <p className="text-xs text-slate-400 mb-3">Detected patterns reduce effective entropy because attackers try these first:</p>
              <div className="space-y-2">
                {analysis.patterns.map((p, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 bg-red-500/5 rounded-lg border border-red-500/10">
                    <span className="text-sm text-red-300">⚠️ {p.name}</span>
                    <span className="text-xs text-red-400 font-mono">-{p.penalty} bits</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 bg-red-500/10 rounded-lg">
                <p className="text-sm text-red-300 font-mono">Total penalty = -{analysis.totalPenalty} bits</p>
              </div>
            </Step>
          )}

          <Step step={analysis.patterns.length > 0 ? 5 : 4} title="Final Effective Entropy" active={true}>
            <div className="font-mono text-sm space-y-2">
              <p className="text-slate-400">
                Effective = Raw{analysis.patterns.length > 0 ? ' - Penalties' : ''}
              </p>
              <p className="text-white">
                Effective = {analysis.rawEntropy.toFixed(2)}{analysis.patterns.length > 0 ? ` - ${analysis.totalPenalty}` : ''}
              </p>
              <div className="p-3 bg-emerald-500/10 rounded-lg mt-2">
                <p className="text-emerald-300 font-bold text-lg">Effective Entropy = {analysis.effectiveEntropy.toFixed(2)} bits</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="p-3 bg-white/5 rounded-lg text-center">
                <p className="text-2xl font-bold text-white">{analysis.crackTime}</p>
                <p className="text-xs text-slate-500">Time to crack (10B hashes/sec)</p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg text-center">
                <p className="text-2xl font-bold text-white">{Math.round(analysis.effectiveEntropy / 128 * 100)}%</p>
                <p className="text-xs text-slate-500">Strength score</p>
              </div>
            </div>
          </Step>
        </>
      )}
    </motion.div>
  );
}
