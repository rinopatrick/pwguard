import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  xp: number;
}

const STORAGE_KEY = 'pwguard-gamification';

function getGameData(): { xp: number; level: number; unlocked: string[]; analysisCount: number; breachCount: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { xp: 0, level: 1, unlocked: [], analysisCount: 0, breachCount: 0 };
  } catch {
    return { xp: 0, level: 1, unlocked: [], analysisCount: 0, breachCount: 0 };
  }
}

const LEVELS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500];

const ALL_ACHIEVEMENTS: Omit<Achievement, 'unlocked'>[] = [
  { id: 'first_analysis', name: 'First Steps', description: 'Analyze your first password', icon: '🔍', xp: 10 },
  { id: 'strong_password', name: 'Ironclad', description: 'Create a password with 80%+ strength', icon: '🛡️', xp: 25 },
  { id: 'no_breaches', name: 'Clean Slate', description: 'Find a password not in any breach database', icon: '✨', xp: 20 },
  { id: 'passphrase_master', name: 'Phrase Crafter', description: 'Generate a passphrase', icon: '📝', xp: 15 },
  { id: 'policy_compliant', name: 'Rule Follower', description: 'Pass all policy compliance checks', icon: '📋', xp: 20 },
  { id: 'bulk_checker', name: 'Bulk Inspector', description: 'Use the bulk analysis feature', icon: '📦', xp: 15 },
  { id: 'security_expert', name: 'Security Expert', description: 'Analyze 100+ passwords', icon: '🎓', xp: 100 },
  { id: 'breach_hunter', name: 'Breach Hunter', description: 'Find 10+ breached passwords', icon: '🎯', xp: 50 },
  { id: 'compare_master', name: 'Comparator', description: 'Compare 3 passwords side by side', icon: '⚖️', xp: 15 },
  { id: 'export_user', name: 'Data Analyst', description: 'Export a password manager file for analysis', icon: '📊', xp: 20 },
  { id: 'monitor_user', name: 'Watchful Eye', description: 'Set up breach monitoring for an email', icon: '👁️', xp: 25 },
  { id: 'team_creator', name: 'Team Leader', description: 'Create a team', icon: '👥', xp: 20 },
  { id: 'darkweb_check', name: 'Dark Web Scanner', description: 'Check a domain for dark web breaches', icon: '🕵️', xp: 30 },
  { id: 'qr_generator', name: 'QR Master', description: 'Generate a QR code for a password', icon: '📱', xp: 10 },
  { id: 'report_export', name: 'Reporter', description: 'Export a password strength report', icon: '📄', xp: 15 },
];

export default function Gamification() {
  const [gameData, setGameData] = useState(getGameData());

  useEffect(() => {
    const handler = () => setGameData(getGameData());
    window.addEventListener('storage', handler);
    // Also poll for changes within same tab
    const interval = setInterval(handler, 2000);
    return () => { window.removeEventListener('storage', handler); clearInterval(interval); };
  }, []);

  const currentLevel = LEVELS.findIndex((xp, i) => i === LEVELS.length - 1 || gameData.xp < LEVELS[i + 1]);
  const nextLevelXp = LEVELS[Math.min(currentLevel + 1, LEVELS.length - 1)];
  const prevLevelXp = LEVELS[currentLevel];
  const progress = nextLevelXp > prevLevelXp ? ((gameData.xp - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100 : 100;

  const achievements: Achievement[] = ALL_ACHIEVEMENTS.map(a => ({
    ...a,
    unlocked: gameData.unlocked.includes(a.id),
  }));

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalXpFromAchievements = achievements.filter(a => a.unlocked).reduce((s, a) => s + a.xp, 0);

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Level & XP */}
      <div className="glass p-6 text-center">
        <div className="text-6xl mb-2">🏆</div>
        <h2 className="text-3xl font-bold text-white">Level {currentLevel + 1}</h2>
        <p className="text-slate-400 text-sm mt-1">{gameData.xp} / {nextLevelXp} XP to next level</p>
        <div className="w-full max-w-xs mx-auto h-3 bg-white/10 rounded-full overflow-hidden mt-4">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1 }}
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
          />
        </div>
        <div className="flex justify-center gap-8 mt-6">
          <div>
            <p className="text-2xl font-bold text-indigo-400">{unlockedCount}</p>
            <p className="text-xs text-slate-500">Achievements</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-400">{totalXpFromAchievements}</p>
            <p className="text-xs text-slate-500">XP Earned</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-400">{gameData.analysisCount}</p>
            <p className="text-xs text-slate-500">Passwords Analyzed</p>
          </div>
        </div>
      </div>

      {/* Achievements Grid */}
      <div className="glass p-5">
        <h3 className="text-sm text-slate-500 uppercase tracking-wider mb-4">
          Achievements ({unlockedCount}/{achievements.length})
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {achievements.map((a, i) => (
            <motion.div
              key={a.id}
              variants={{ hidden: { opacity: 0, scale: 0.8 }, show: { opacity: 1, scale: 1 } }}
              className={`p-4 rounded-xl border transition-all ${
                a.unlocked
                  ? 'bg-indigo-500/10 border-indigo-500/30'
                  : 'bg-white/2 border-white/5 opacity-50'
              }`}
            >
              <div className="text-2xl mb-2">{a.unlocked ? a.icon : '🔒'}</div>
              <p className={`text-sm font-medium ${a.unlocked ? 'text-white' : 'text-slate-500'}`}>{a.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{a.description}</p>
              <p className="text-xs text-indigo-400 mt-1">+{a.xp} XP</p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// Helper to track gamification events (call from other components)
export function trackEvent(eventId: string) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : { xp: 0, level: 1, unlocked: [], analysisCount: 0, breachCount: 0 };

    if (eventId === 'analysis') data.analysisCount++;
    if (eventId === 'breach_found') data.breachCount++;

    const achievement = ALL_ACHIEVEMENTS.find(a => a.id === eventId);
    if (achievement && !data.unlocked.includes(eventId)) {
      data.unlocked.push(eventId);
      data.xp += achievement.xp;
    }

    // Auto-unlock based on counters
    if (data.analysisCount >= 1 && !data.unlocked.includes('first_analysis')) {
      const a = ALL_ACHIEVEMENTS.find(x => x.id === 'first_analysis')!;
      data.unlocked.push('first_analysis');
      data.xp += a.xp;
    }
    if (data.analysisCount >= 100 && !data.unlocked.includes('security_expert')) {
      const a = ALL_ACHIEVEMENTS.find(x => x.id === 'security_expert')!;
      data.unlocked.push('security_expert');
      data.xp += a.xp;
    }
    if (data.breachCount >= 10 && !data.unlocked.includes('breach_hunter')) {
      const a = ALL_ACHIEVEMENTS.find(x => x.id === 'breach_hunter')!;
      data.unlocked.push('breach_hunter');
      data.xp += a.xp;
    }

    // Level up
    data.level = LEVELS.findIndex((xp, i) => i === LEVELS.length - 1 || data.xp < LEVELS[i + 1]) + 1;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}
