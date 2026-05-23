import { motion, animate, useMotionValue, useTransform } from 'framer-motion';
import { useEffect } from 'react';

interface Props {
  display: string;
  seconds: number;
}

function getUrgencyColor(seconds: number): string {
  if (seconds < 1) return '#ef4444';
  if (seconds < 3600) return '#f97316';
  if (seconds < 31536000) return '#eab308';
  return '#10b981';
}

function getUrgencyBg(seconds: number): string {
  if (seconds < 1) return 'from-red-500/10 to-red-500/5';
  if (seconds < 3600) return 'from-orange-500/10 to-orange-500/5';
  if (seconds < 31536000) return 'from-yellow-500/10 to-yellow-500/5';
  return 'from-emerald-500/10 to-emerald-500/5';
}

function getIcon(seconds: number): string {
  if (seconds < 1) return '💥';
  if (seconds < 60) return '⚡';
  if (seconds < 3600) return '⏱️';
  if (seconds < 86400) return '🕐';
  if (seconds < 31536000) return '📅';
  return '🛡️';
}

export default function CrackTimeDisplay({ display, seconds }: Props) {
  const color = getUrgencyColor(seconds);
  const bg = getUrgencyBg(seconds);
  const icon = getIcon(seconds);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`glass p-6 bg-gradient-to-br ${bg} text-center`}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">
        Time to crack
      </p>
      <motion.p
        key={display}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="text-2xl font-bold tracking-tight"
        style={{ color }}
      >
        {display}
      </motion.p>
      <p className="text-xs text-slate-600 mt-2">
        at 10 billion hashes/sec (GPU farm)
      </p>
    </motion.div>
  );
}
