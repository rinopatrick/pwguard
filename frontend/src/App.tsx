import { useState, useCallback } from 'react';
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
import BulkCheck from './components/BulkCheck';
import Dashboard from './components/Dashboard';
import PolicyBuilder from './components/PolicyBuilder';
import { usePasswordAnalysis } from './hooks/usePasswordAnalysis';
import { useI18n } from './i18n';

type Tab = 'analyzer' | 'generator' | 'passphrase' | 'compare' | 'history' | 'bulk' | 'dashboard' | 'bookmarklet' | 'policyBuilder';

export default function App() {
  const { t, lang, setLang } = useI18n();
  const { password, setPassword, result, loading, policy, setPolicy, forbiddenWords, setForbiddenWords } = usePasswordAnalysis();
  const [activeTab, setActiveTab] = useState<Tab>('analyzer');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('pwguard-theme') as 'dark' | 'light') || 'dark');

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('pwguard-theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  }, [theme]);

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'analyzer', label: t('tab.analyzer'), icon: '🔍' },
    { id: 'generator', label: t('tab.generator'), icon: '🎲' },
    { id: 'passphrase', label: t('tab.passphrase'), icon: '📝' },
    { id: 'compare', label: t('tab.compare'), icon: '⚖️' },
    { id: 'bulk', label: t('tab.bulk'), icon: '📦' },
    { id: 'dashboard', label: t('tab.dashboard'), icon: '📊' },
    { id: 'history', label: t('tab.history'), icon: '🕐' },
    { id: 'policyBuilder', label: t('tab.policyBuilder'), icon: '📋' },
    { id: 'bookmarklet', label: t('tab.bookmarklet'), icon: '🔖' },
  ];

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

  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen py-12 px-4 transition-colors ${isDark ? '' : 'bg-gradient-to-br from-slate-100 via-white to-slate-100'}`}>
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
          style={{
            background: isDark
              ? result
                ? result.strength_percent < 50
                  ? 'radial-gradient(circle, rgba(239,68,68,0.3), transparent 70%)'
                  : result.strength_percent < 75
                    ? 'radial-gradient(circle, rgba(234,179,8,0.3), transparent 70%)'
                    : 'radial-gradient(circle, rgba(16,185,129,0.3), transparent 70%)'
                : 'radial-gradient(circle, rgba(99,102,241,0.2), transparent 70%)'
              : 'radial-gradient(circle, rgba(99,102,241,0.1), transparent 70%)',
          }}
        />
      </div>

      <div className="relative max-w-2xl mx-auto space-y-8">
        {/* Header with theme/lang toggle */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-3"
        >
          <div className="flex items-center justify-between">
            {/* Language toggle */}
            <div className="flex gap-1">
              {(['en', 'id'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    lang === l
                      ? isDark ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-indigo-100 text-indigo-600 border border-indigo-300'
                      : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {l === 'en' ? '🇺🇸 EN' : '🇮🇩 ID'}
                </button>
              ))}
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-all ${isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'}`}
              title={isDark ? t('theme.light') : t('theme.dark')}
            >
              {isDark ? '☀️' : '🌙'}
            </button>
          </div>

          <h1 className={`text-4xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {t('app.title')}
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"> {t('app.titleHighlight')}</span>
          </h1>
          <p className={`text-sm max-w-md mx-auto ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {t('app.subtitle')}
          </p>
        </motion.div>

        {/* Tab bar */}
        <div className="flex justify-center overflow-x-auto">
          <div className={`p-1 flex gap-1 rounded-2xl ${isDark ? 'glass' : 'bg-white/80 backdrop-blur-xl border border-slate-200 shadow-sm'}`}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === tab.id
                    ? isDark ? 'text-white' : 'text-slate-900'
                    : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="tab-bg"
                    className={`absolute inset-0 rounded-xl ${isDark ? 'bg-white/10' : 'bg-indigo-50'}`}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{tab.icon}</span>
                <span className="relative z-10 hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {activeTab === 'analyzer' && (
            <motion.div key="analyzer" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-8">
              <PasswordInput password={password} onChange={setPassword} />
              <div className="space-y-3">
                <PolicySelector selected={policy} onSelect={setPolicy} compliant={result?.policy_compliant ?? true} violations={result?.policy_violations ?? []} />
                <WordlistManager onWordsChange={setForbiddenWords} />
              </div>
              <AnimatePresence mode="wait">
                {result && (
                  <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="space-y-8">
                    <div className="flex flex-col md:flex-row items-center gap-8 justify-center">
                      <StrengthGauge percent={result.strength_percent} label={result.strength_label} />
                      <div className="w-full md:w-auto md:min-w-[280px]">
                        <CrackTimeDisplay display={result.crack_time_display} seconds={result.crack_time_seconds} />
                      </div>
                    </div>
                    <AnalysisPanel result={result} />
                  </motion.div>
                )}
              </AnimatePresence>
              {!password && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                  className={`p-10 text-center rounded-2xl ${isDark ? 'glass' : 'bg-white/80 backdrop-blur-xl border border-slate-200'}`}>
                  <div className="text-4xl mb-4">🔐</div>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('analyzer.enterPassword')}</p>
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === 'generator' && (
            <motion.div key="generator" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <PasswordGenerator onGenerate={() => {}} />
            </motion.div>
          )}

          {activeTab === 'passphrase' && (
            <motion.div key="passphrase" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <PassphraseGenerator onGenerate={() => {}} />
            </motion.div>
          )}

          {activeTab === 'compare' && (
            <motion.div key="compare" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <CompareTab />
            </motion.div>
          )}

          {activeTab === 'bulk' && (
            <motion.div key="bulk" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <BulkCheck />
            </motion.div>
          )}

          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <Dashboard />
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <PasswordHistory />
            </motion.div>
          )}

          {activeTab === 'policyBuilder' && (
            <motion.div key="policyBuilder" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <PolicyBuilder />
            </motion.div>
          )}

          {activeTab === 'bookmarklet' && (
            <motion.div key="bookmarklet" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <Bookmarklet />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className={`text-center text-xs pt-4 ${isDark ? 'text-slate-700' : 'text-slate-300'}`}>
          {t('footer.text')}
        </motion.p>
      </div>
    </div>
  );
}
