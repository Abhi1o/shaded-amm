'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export interface AnimatedStatProps {
  value: string | number;
  label: string;
  gradient: string;
  icon?: React.ReactNode;
  delay?: number;
  prefix?: string;
  suffix?: string;
}

export function AnimatedStat({
  value,
  label,
  gradient,
  icon,
  delay = 0,
  prefix = '',
  suffix = '',
}: AnimatedStatProps) {
  const [displayValue, setDisplayValue] = useState<string | number>(0);
  const isNumeric = typeof value === 'number';

  useEffect(() => {
    if (!isNumeric) {
      setDisplayValue(value);
      return;
    }

    const duration = 1000;
    const steps = 60;
    const increment = value / steps;
    let current = 0;

    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        current += increment;
        if (current >= value) {
          setDisplayValue(value);
          clearInterval(interval);
        } else {
          setDisplayValue(Math.floor(current));
        }
      }, duration / steps);

      return () => clearInterval(interval);
    }, delay * 1000);

    return () => clearTimeout(timer);
  }, [value, isNumeric, delay]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.4, 0.25, 1] }}
      className="backdrop-blur-xl bg-white/5 rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all"
    >
      {icon && (
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} p-2.5 mb-4`}>
          {icon}
        </div>
      )}
      <div className={`text-3xl sm:text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r ${gradient}`}>
        {prefix}{displayValue}{suffix}
      </div>
      <div className="text-sm text-gray-400 font-light">{label}</div>
    </motion.div>
  );
}
