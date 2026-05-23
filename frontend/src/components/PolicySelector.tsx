import { motion } from 'framer-motion';

interface Props {
  selected: string | null;
  onSelect: (policy: string | null) => void;
  compliant: boolean;
  violations: string[];
}

const POLICIES = [
  { id: 'NIST', label: 'NIST', desc: 'Min 8 chars, breach check' },
  { id: 'PCI-DSS', label: 'PCI-DSS', desc: 'Min 12 chars, all types, breach check' },
  { id: 'Corporate', label: 'Corporate', desc: 'Min 14 chars, no repeats, breach check' },
  { id: 'Basic', label: 'Basic', desc: 'Min 8 chars' },
];

export default function PolicySelector({ selected, onSelect, compliant, violations }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 uppercase tracking-wider">Strength Policy</p>
        {selected && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            compliant
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-red-500/20 text-red-300'
          }`}>
            {compliant ? '✓ Compliant' : '✗ Non-compliant'}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onSelect(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            selected === null
              ? 'bg-white/10 border border-white/20 text-white'
              : 'bg-white/5 border border-transparent text-slate-500 hover:text-white'
          }`}
        >
          None
        </button>
        {POLICIES.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selected === p.id
                ? 'bg-indigo-500/20 border border-indigo-500/50 text-indigo-300'
                : 'bg-white/5 border border-transparent text-slate-500 hover:text-white'
            }`}
            title={p.desc}
          >
            {p.label}
          </button>
        ))}
      </div>

      {selected && (
        <p className="text-xs text-slate-500">
          {POLICIES.find((p) => p.id === selected)?.desc}
        </p>
      )}

      {selected && !compliant && violations.length > 0 && (
        <div className="space-y-2">
          {violations.map((v, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-2 text-xs"
            >
              <span className="text-red-400 mt-0.5">✗</span>
              <span className="text-red-300">{v}</span>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
