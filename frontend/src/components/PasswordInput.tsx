import { useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  password: string;
  onChange: (value: string) => void;
}

export default function PasswordInput({ password, onChange }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="w-full max-w-xl mx-auto"
    >
      <div className="glass-strong p-1.5 group focus-within:border-white/20 transition-all duration-300 focus-within:shadow-lg focus-within:shadow-indigo-500/10">
        <div className="relative flex items-center">
          {/* Lock icon */}
          <div className="pl-5 pr-2 text-slate-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <input
            type={visible ? 'text' : 'password'}
            value={password}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type your password..."
            className="flex-1 bg-transparent text-lg font-mono text-white placeholder-slate-600 py-4 px-2 outline-none tracking-wide"
            autoComplete="off"
            spellCheck={false}
          />

          {/* Eye toggle */}
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="pr-5 pl-2 text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Character count */}
      <div className="flex justify-between mt-3 px-2">
        <span className="text-xs text-slate-600">
          {password.length > 0 ? `${password.length} characters` : ''}
        </span>
        <span className="text-xs text-slate-600">
          {password.length > 0 ? 'Analyzing...' : 'Start typing to analyze'}
        </span>
      </div>
    </motion.div>
  );
}
