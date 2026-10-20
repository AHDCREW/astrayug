import { useEffect, useState } from 'react';

export interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

export function getTimeLeft(target: Date, now = Date.now()): TimeLeft {
  const diff = Math.max(0, target.getTime() - now);
  const total = Math.floor(diff / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    done: diff === 0,
  };
}

// Ticks on whole-second boundaries so every unit flips together.
export function useCountdown(target: Date): TimeLeft {
  const [left, setLeft] = useState(() => getTimeLeft(target));

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      const next = getTimeLeft(target);
      setLeft(next);
      if (!next.done) timer = window.setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [target]);

  return left;
}
