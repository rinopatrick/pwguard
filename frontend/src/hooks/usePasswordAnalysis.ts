import { useState, useEffect, useRef } from 'react';

export interface AnalysisResult {
  password_length: number;
  charset_size: number;
  entropy: number;
  crack_time_seconds: number;
  crack_time_display: string;
  strength_percent: number;
  strength_label: string;
  patterns: { name: string; description: string; penalty: number }[];
  charset_breakdown: Record<string, number>;
  breach_count: number;
  breach_checked: boolean;
  policy_compliant: boolean;
  policy_violations: string[];
  zxcvbn_score: number;
  zxcvbn_feedback: string[];
  hibp_cached: boolean;
}

export function usePasswordAnalysis() {
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [policy, setPolicy] = useState<string | null>(null);
  const [forbiddenWords, setForbiddenWords] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!password) {
      setResult(null);
      return;
    }

    setLoading(true);
    clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const body: Record<string, unknown> = { password };
        if (policy) body.policy = policy;
        if (forbiddenWords.length > 0) body.forbidden_words = forbiddenWords;

        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.json();
          setResult(data);
        }
      } catch (err) {
        console.error('Analysis failed:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [password, policy, forbiddenWords]);

  return { password, setPassword, result, loading, policy, setPolicy, forbiddenWords, setForbiddenWords };
}
