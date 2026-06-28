'use client';

import { useState, useEffect } from 'react';

interface WaitTimerProps {
  startedAt: string;  // ISO timestamp when driver arrived at pickup
  maxSeconds: number; // 180 = 3 minutes
  onExpire?: () => void;
}

export default function WaitTimer({ startedAt, maxSeconds, onExpire }: WaitTimerProps) {
  const [remaining, setRemaining] = useState(() => {
    const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    return Math.max(0, maxSeconds - elapsed);
  });

  useEffect(() => {
    const tick = () => {
      const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      const left = Math.max(0, maxSeconds - elapsed);
      setRemaining(left);
      if (left <= 0) onExpire?.();
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt, maxSeconds, onExpire]);

  const minutes  = Math.floor(remaining / 60);
  const seconds  = remaining % 60;
  const isExpiring = remaining < 60;

  return (
    <span className={`text-sm font-mono font-bold tabular-nums ${
      isExpiring ? 'text-[#E74C3C]' : 'text-[#F5A623]'
    }`}>
      {minutes}:{String(seconds).padStart(2, '0')} ⏱
    </span>
  );
}
