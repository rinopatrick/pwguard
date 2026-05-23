import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PasswordInput from './components/PasswordInput';
import StrengthGauge from './components/StrengthGauge';
import CrackTimeDisplay from './components/CrackTimeDisplay';
import AnalysisPanel from './components/AnalysisPanel';
import PasswordGenerator from './components/PasswordGenerator';
import PassphraseGenerator from './components/PassphraseGenerator';
import PasswordHistory, { addHistoryEntry } from './components/PasswordHistory';
import CompareTab from './components/CompareTab';
import Bookmarklet from './components/Bookmarklet';
import WordlistManager from './components/WordlistManager';
import PolicySelector from './components/PolicySelector';
import { usePasswordAnalysis } from './hooks/usePasswordAnalysis';

type Tab = 'analyzer' | 'generator' | 'passphrase' | 'compare' | 'history' | 'bookmarklet';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'analyzer', label: 'Analyzer', icon: '🔍' },
  { id: 'generator', label: 'Generator', icon: '🎲' },
  { id: 'passphrase', label: 'Passphrase', icon: '📝' },
  { id: 'compare', label: 'Compare', icon: '⚖️' },
  { id: 'history', label: 'History', icon: '📊' },
  { id: 'bookmarklet', label: 'Bookmarklet', icon: '🔖' },
];

export default function App() {
  const { password, setPassword, result, loading, policy, setPolicy, forbiddenWords, setForbiddenWords } = usePasswordAnalysis();
  const [activeTab, setActiveTab] = useState<Tab>('analyzer');

  // Save to history when result changes
  const lastSavedRef = { current: '' };
  if (result && password && password !== lastSavedRef.current) {
    lastSavedRef.current = password;
    addHistoryEntry({
      strength_percent: result.strength_percent,
      strength_label: result.strength_label,
      entropy: result.entropy,
      length: result.password_length,
      breach_count: result.breach_count,
    });
  }

  return (
    <div className="min-h-screen py-12 px-4">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
          style={{
            background: result
              ? result.strength_percent < 50
                ? 'radial-gradient(circle, rgba(239,68,68,0.3), transparent 70%)'
                : result.strength_percent < 75
                  ? 'radial-gradient(circle, rgba(234,179,8,0.3), transparent 70%)'
                  : 'radial-gradient(circle, rgba(16,185,129,0.3), transparent 70%)'
              : 'radial-gradient(circle, rgba(99,102,241,0.2), transparent 70%)',
          }}
        />
      </div>

      <div className="relative max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-3"
        >
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Password Strength
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"> Visualizer</span>
          </h1>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Analyze, generate, and manage strong passwords with entropy analysis, breach detection, zxcvbn scoring, and policy compliance.
          </p>
        </motion.div>

        {/* Tab bar */}
        <div className="flex justify-center overflow-x-auto">
          <div className="glass p-1 flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-white'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="tab-bg"
                    className="absolute inset-0 bg-white/10 rounded-xl"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{tab.icon}</span>
                <span className="relative z-10">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {activeTab === 'analyzer' && (
            <motion.div
              key="analyzer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              {/* Input */}
              <PasswordInput password={password} onChange={setPassword} />

              {/* Policy + Wordlist (above results) */}
              <div className="space-y-3">
                <PolicySelector
                  selected={policy}
                  onSelect={setPolicy}
                  compliant={result?.policy_compliant ?? true}
                  violations={result?.policy_violations ?? []}
                />
                <WordlistManager onWordsChange={setForbiddenWords} />
              </div>

              {/* Results */}
              <AnimatePresence mode="wait">
                {result && (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-8"
                  >
                    {/* Gauge + Crack Time */}
                    <div className="flex flex-col md:flex-row items-center gap-8 justify-center">
                      <StrengthGauge percent={result.strength_percent} label={result.strength_label} />
                      <div className="w-full md:w-auto md:min-w-[280px]">
                        <CrackTimeDisplay display={result.crack_time_display} seconds={result.crack_time_seconds} />
                      </div>
                    </div>

                    {/* Analysis Panel */}
                    <AnalysisPanel result={result} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Empty state */}
              {!password && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="glass p-10 text-center"
                >
                  <div className="text-4xl mb-4">🔐</div>
                  <p className="text-slate-400 text-sm">
                    Enter a password above to see its strength analysis
                  </p>
                  <div className="mt-6 grid grid-cols-3 gap-4 max-w-sm mx-auto">
                    {[
                      { label: 'Entropy', desc: 'Randomness measure' },
                      { label: 'Crack Time', desc: 'GPU attack estimate' },
                      { label: 'zxcvbn', desc: 'Dictionary-based score' },
                    ].map((f) => (
                      <div key={f.label} className="text-center">
                        <p className="text-xs font-medium text-slate-300">{f.label}</p>
                        <p className="text-xs text-slate-600 mt-0.5">{f.desc}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === 'generator' && (
            <motion.div
              key="generator"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <PasswordGenerator onGenerate={() => {}} />
            </motion.div>
          )}

          {activeTab === 'passphrase' && (
            <motion.div
              key="passphrase"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <PassphraseGenerator onGenerate={() => {}} />
            </motion.div>
          )}

          {activeTab === 'compare' && (
            <motion.div
              key="compare"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <CompareTab />
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <PasswordHistory />
            </motion.div>
          )}

          {activeTab === 'bookmarklet' && (
            <motion.div
              key="bookmarklet"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Bookmarklet />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-xs text-slate-700 pt-4"
        >
          Passwords are analyzed locally and never stored. History saves only strength metrics.
        </motion.p>
      </div>
    </div>
  );
}
