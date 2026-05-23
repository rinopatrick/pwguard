import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  onWordsChange: (words: string[]) => void;
}

export default function WordlistManager({ onWordsChange }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [count, setCount] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('pw_forbidden_words');
    if (saved) {
      setText(saved);
      const words = saved.split('\n').filter((w) => w.trim().length >= 2);
      setCount(words.length);
      onWordsChange(words);
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('pw_forbidden_words', text);
    const words = text.split('\n').filter((w) => w.trim().length >= 2);
    setCount(words.length);
    onWordsChange(words);
  };

  const handleClear = () => {
    setText('');
    setCount(0);
    localStorage.removeItem('pw_forbidden_words');
    onWordsChange([]);
  };

  return (
    <div className="glass overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">🚫</span>
          <span className="text-sm text-slate-300">Custom Forbidden Words</span>
          {count > 0 && (
            <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">
              {count} words
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-3">
              <p className="text-xs text-slate-500">
                Enter words that should not appear in passwords (one per line).
                Passwords containing these words will receive a heavy penalty.
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="company&#10;brand&#10;yourname&#10;domain.com"
                rows={5}
                className="w-full bg-white/5 text-sm text-slate-200 font-mono px-4 py-3 rounded-lg border border-white/10 outline-none focus:border-indigo-500/50 resize-none placeholder-slate-600"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex-1 py-2 rounded-lg bg-indigo-500/20 text-indigo-300 text-sm font-medium hover:bg-indigo-500/30 transition-colors"
                >
                  Save Words
                </button>
                <button
                  onClick={handleClear}
                  className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
