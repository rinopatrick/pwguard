import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '../i18n';

interface Policy {
  min_length: number;
  max_length: number;
  require_upper: boolean;
  require_lower: boolean;
  require_digit: boolean;
  require_symbol: boolean;
  max_repeats: number;
  check_breaches: boolean;
}

const DEFAULT_POLICY: Policy = {
  min_length: 8,
  max_length: 0,
  require_upper: true,
  require_lower: true,
  require_digit: true,
  require_symbol: true,
  max_repeats: 0,
  check_breaches: true,
};

export default function PolicyBuilder() {
  const { t } = useI18n();
  const [policy, setPolicy] = useState<Policy>(() => {
    try {
      return JSON.parse(localStorage.getItem('pwguard-custom-policy') || 'null') || DEFAULT_POLICY;
    } catch {
      return DEFAULT_POLICY;
    }
  });
  const [testPassword, setTestPassword] = useState('');
  const [testResult, setTestResult] = useState<{ compliant: boolean; violations: string[] } | null>(null);

  const update = <K extends keyof Policy>(key: K, value: Policy[K]) => {
    setPolicy((p) => ({ ...p, [key]: value }));
  };

  const handleSave = useCallback(() => {
    localStorage.setItem('pwguard-custom-policy', JSON.stringify(policy));
  }, [policy]);

  const handleTest = useCallback(async () => {
    if (!testPassword) return;
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: testPassword, policy: 'Custom' }),
      });
      const data = await res.json();
      setTestResult({
        compliant: data.policy_compliant,
        violations: data.policy_violations,
      });
    } catch {
      // fallback: test locally
      const violations: string[] = [];
      if (testPassword.length < policy.min_length) violations.push(`Min length: ${policy.min_length}`);
      if (policy.max_length > 0 && testPassword.length > policy.max_length) violations.push(`Max length: ${policy.max_length}`);
      if (policy.require_upper && !/[A-Z]/.test(testPassword)) violations.push('Requires uppercase');
      if (policy.require_lower && !/[a-z]/.test(testPassword)) violations.push('Requires lowercase');
      if (policy.require_digit && !/[0-9]/.test(testPassword)) violations.push('Requires digit');
      if (policy.require_symbol && !/[^a-zA-Z0-9]/.test(testPassword)) violations.push('Requires symbol');
      setTestResult({ compliant: violations.length === 0, violations });
    }
  }, [testPassword, policy]);

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(policy, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pwguard-policy.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [policy]);

  return (
    <div className="space-y-6">
      <div className="glass p-5">
        <h2 className="text-lg font-bold text-white mb-4">{t('policyBuilder.title')}</h2>

        {/* Min length */}
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-400">{t('policyBuilder.minLen')}</span>
              <span className="text-sm text-white font-mono">{policy.min_length}</span>
            </div>
            <input type="range" min={0} max={32} value={policy.min_length}
              onChange={(e) => update('min_length', Number(e.target.value))}
              className="w-full accent-indigo-500" />
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-400">{t('policyBuilder.maxLen')}</span>
              <span className="text-sm text-white font-mono">{policy.max_length || '∞'}</span>
            </div>
            <input type="range" min={0} max={128} value={policy.max_length}
              onChange={(e) => update('max_length', Number(e.target.value))}
              className="w-full accent-indigo-500" />
          </div>

          {/* Toggle switches */}
          {[
            { key: 'require_upper' as const, label: t('policyBuilder.requireUpper') },
            { key: 'require_lower' as const, label: t('policyBuilder.requireLower') },
            { key: 'require_digit' as const, label: t('policyBuilder.requireDigit') },
            { key: 'require_symbol' as const, label: t('policyBuilder.requireSymbol') },
            { key: 'check_breaches' as const, label: t('policyBuilder.checkBreaches') },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <span className="text-sm text-slate-300">{item.label}</span>
              <div
                className={`w-11 h-6 rounded-full relative cursor-pointer transition-all ${
                  policy[item.key] ? 'bg-indigo-500' : 'bg-white/10'
                }`}
                onClick={() => update(item.key, !policy[item.key])}
              >
                <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                  style={{ left: policy[item.key] ? '22px' : '2px' }} />
              </div>
            </div>
          ))}

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-400">{t('policyBuilder.maxRepeats')}</span>
              <span className="text-sm text-white font-mono">{policy.max_repeats || '∞'}</span>
            </div>
            <input type="range" min={0} max={10} value={policy.max_repeats}
              onChange={(e) => update('max_repeats', Number(e.target.value))}
              className="w-full accent-indigo-500" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium">
            {t('policyBuilder.save')}
          </button>
          <button onClick={handleExport} className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium">
            {t('policyBuilder.export')}
          </button>
        </div>
      </div>

      {/* JSON preview */}
      <div className="glass p-5">
        <h3 className="text-sm font-semibold text-white mb-3">{t('policyBuilder.preview')}</h3>
        <pre className="bg-black/30 rounded-lg p-4 text-xs text-slate-300 font-mono overflow-auto">
          {JSON.stringify(policy, null, 2)}
        </pre>
      </div>

      {/* Test password */}
      <div className="glass p-5">
        <h3 className="text-sm font-semibold text-white mb-3">{t('policyBuilder.test')}</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={testPassword}
            onChange={(e) => setTestPassword(e.target.value)}
            placeholder={t('analyzer.placeholder')}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500/50"
          />
          <motion.button whileTap={{ scale: 0.95 }} onClick={handleTest}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium">
            Test
          </motion.button>
        </div>
        {testResult && (
          <div className={`mt-3 p-3 rounded-lg ${testResult.compliant ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
            <p className={`text-sm font-medium ${testResult.compliant ? 'text-emerald-400' : 'text-red-400'}`}>
              {testResult.compliant ? `✅ ${t('policyBuilder.compliant')}` : `❌ ${t('policyBuilder.violations')}:`}
            </p>
            {testResult.violations.length > 0 && (
              <ul className="mt-2 space-y-1">
                {testResult.violations.map((v, i) => (
                  <li key={i} className="text-xs text-red-300">→ {v}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
