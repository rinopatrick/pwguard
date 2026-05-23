import { motion } from 'framer-motion';
import type { AnalysisResult } from '../hooks/usePasswordAnalysis';
import ReportExport from './ReportExport';

interface Props {
  result: AnalysisResult;
}

const charsetLabels: Record<string, string> = {
  lowercase: 'Lowercase (a-z)',
  uppercase: 'Upper (A-Z)',
  digits: 'Digits (0-9)',
  symbols: 'Symbols (!@#$...)',
};

const zxcvbnLabels = ['Too Guessable', 'Very Guessable', 'Somewhat Guessable', 'Safe', 'Very Safe'];
const zxcvbnColors = ['#ef4444', '#f97316', '#eab308', '#10b981', '#059669'];

function CharsetBadge({ name, count }: { name: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
      <span className="w-2 h-2 rounded-full bg-emerald-400" />
      <span className="text-sm text-slate-300">
        {charsetLabels[name] || name}
      </span>
      <span className="text-xs text-slate-500 ml-auto font-mono">
        {count}
      </span>
    </div>
  );
}

function PatternCard({ name, description, penalty }: { name: string; description: string; penalty: number }) {
  const isBreach = name === 'breached_password';
  const isUnavailable = name === 'hibp_unavailable';
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-start gap-3 px-4 py-3 rounded-xl ${
        isBreach
          ? 'bg-red-500/15 border-2 border-red-500/30'
          : isUnavailable
            ? 'bg-yellow-500/10 border border-yellow-500/20'
            : 'bg-red-500/5 border border-red-500/10'
      }`}
    >
      <span className="text-lg mt-0.5">{isBreach ? '🔴' : isUnavailable ? '⚡' : '⚠️'}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isBreach ? 'text-red-300' : isUnavailable ? 'text-yellow-300' : 'text-slate-200'}`}>{description}</p>
        {penalty > 0 && <p className="text-xs text-slate-500 mt-0.5">Penalty: -{penalty} entropy bits</p>}
      </div>
    </motion.div>
  );
}

export default function AnalysisPanel({ result }: Props) {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };
  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 },
  };

  const zxScore = Math.min(result.zxcvbn_score, 4);
  const zxColor = zxcvbnColors[zxScore];
  const zxLabel = zxcvbnLabels[zxScore];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      {/* Stats row */}
      <motion.div variants={item} className="grid grid-cols-2 gap-3">
        <div className="glass p-4 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Entropy</p>
          <p className="text-2xl font-bold text-white font-mono">{result.entropy}</p>
          <p className="text-xs text-slate-500">bits</p>
        </div>
        <div className="glass p-4 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Length</p>
          <p className="text-2xl font-bold text-white font-mono">{result.password_length}</p>
          <p className="text-xs text-slate-500">characters</p>
        </div>
      </motion.div>

      {/* zxcvbn Score */}
      <motion.div variants={item} className="glass p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-slate-500 uppercase tracking-wider">zxcvbn Score</p>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-8 h-2 rounded-full transition-colors"
                style={{
                  backgroundColor: i <= zxScore ? zxColor : 'rgba(255,255,255,0.05)',
                }}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-3xl font-bold font-mono" style={{ color: zxColor }}>
            {zxScore}/4
          </span>
          <span className="text-sm font-medium" style={{ color: zxColor }}>
            {zxLabel}
          </span>
        </div>
        {result.zxcvbn_feedback.length > 0 && (
          <div className="mt-3 space-y-1">
            {result.zxcvbn_feedback.map((f, i) => (
              <p key={i} className="text-xs text-slate-400 flex items-start gap-2">
                <span className="text-slate-600 mt-0.5">→</span>
                {f}
              </p>
            ))}
          </div>
        )}
      </motion.div>

      {/* Charset breakdown */}
      {Object.keys(result.charset_breakdown).length > 0 && (
        <motion.div variants={item} className="glass p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">
            Character set detected ({result.charset_size} possible chars)
          </p>
          <div className="space-y-2">
            {Object.entries(result.charset_breakdown).map(([name, count]) => (
              <CharsetBadge key={name} name={name} count={count} />
            ))}
          </div>
        </motion.div>
      )}

      {/* Breach check */}
      {result.breach_checked && result.breach_count > 0 && (
        <motion.div variants={item} className="p-5 rounded-xl bg-red-500/10 border-2 border-red-500/30">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔴</span>
            <div>
              <p className="text-red-300 font-bold text-lg">
                Found in {result.breach_count.toLocaleString()} data breaches!
              </p>
              <p className="text-xs text-red-400/80 mt-1">
                This password has been exposed in known data breaches. It should NEVER be used.
                <br />Source: Have I Been Pwned (pwnedpasswords.com)
                {result.hibp_cached && <span className="text-slate-500"> · cached result</span>}
              </p>
            </div>
          </div>
        </motion.div>
      )}
      {result.breach_checked && result.breach_count === 0 && result.patterns.length === 0 && result.strength_percent >= 60 && (
        <motion.div variants={item} className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛡️</span>
            <div>
              <p className="text-emerald-300 font-bold">Not found in any known data breaches</p>
              <p className="text-xs text-emerald-400/70 mt-1">
                Checked against Have I Been Pwned database
                {result.hibp_cached && <span className="text-slate-500"> · cached</span>}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Patterns */}
      {result.patterns.length > 0 && (
        <motion.div variants={item} className="space-y-3">
          <p className="text-xs text-slate-500 uppercase tracking-wider px-1">
            Weaknesses detected ({result.patterns.length})
          </p>
          {result.patterns.map((p, i) => (
            <PatternCard key={i} {...p} />
          ))}
        </motion.div>
      )}

      {/* No weaknesses */}
      {result.patterns.length === 0 && result.strength_percent >= 60 && (
        <motion.div variants={item} className="glass p-5 text-center">
          <span className="text-2xl">✨</span>
          <p className="text-sm text-emerald-400 mt-2 font-medium">No common weaknesses detected</p>
        </motion.div>
      )}

      {/* Export Report */}
      <motion.div variants={item}>
        <ReportExport />
      </motion.div>
    </motion.div>
  );
}
