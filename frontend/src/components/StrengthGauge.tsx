import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect } from 'react';

interface Props {
  percent: number;
  label: string;
}

function getStrengthColor(percent: number): string {
  if (percent < 25) return '#ef4444';   // red
  if (percent < 50) return '#f97316';   // orange
  if (percent < 75) return '#eab308';   // yellow
  return '#10b981';                     // emerald
}

function getGlowClass(percent: number): string {
  if (percent < 25) return 'glow-red';
  if (percent < 50) return 'glow-orange';
  if (percent < 75) return 'glow-yellow';
  return 'glow-emerald';
}

function AnimatedNumber({ value }: { value: number }) {
  const motionVal = useMotionValue(0);
  const rounded = useTransform(motionVal, (v) => Math.round(v));

  useEffect(() => {
    const ctrl = animate(motionVal, value, {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
    });
    return ctrl.stop;
  }, [value, motionVal]);

  return <motion.span>{rounded}</motion.span>;
}

export default function StrengthGauge({ percent, label }: Props) {
  const size = 200;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const color = getStrengthColor(percent);
  const glowClass = getGlowClass(percent);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`flex flex-col items-center ${glowClass}`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={strokeWidth}
          />
          {/* Progress arc */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: `drop-shadow(0 0 10px ${color}80)` }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
          <span
            className="text-5xl font-bold tabular-nums"
            style={{ color }}
          >
            <AnimatedNumber value={percent} />
          </span>
          <span className="text-xs text-slate-500 mt-1 uppercase tracking-widest">
            score
          </span>
        </div>
      </div>

      {/* Label */}
      <motion.div
        key={label}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-4 text-center"
      >
        <span
          className="text-lg font-semibold tracking-wide"
          style={{ color }}
        >
          {label}
        </span>
        <p className="text-xs text-slate-500 mt-1">Password Strength</p>
      </motion.div>
    </motion.div>
  );
}
