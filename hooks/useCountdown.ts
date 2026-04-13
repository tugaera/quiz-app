// hooks/useCountdown.ts — requestAnimationFrame-based countdown
// Derives remaining time from a server-provided start timestamp.
"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type CountdownState = {
  /** Seconds remaining (float) */
  remaining: number;
  /** Fraction of total time remaining: 1 = full, 0 = expired */
  fraction: number;
  /** True when time is up */
  isExpired: boolean;
};

export function useCountdown(
  questionStartedAt: string | null,
  timeLimitSeconds: number | null
): CountdownState {
  const [state, setState] = useState<CountdownState>({
    remaining: timeLimitSeconds ?? 0,
    fraction: 1,
    isExpired: false,
  });
  const rafRef = useRef<number>(0);

  const tick = useCallback(() => {
    if (!questionStartedAt || !timeLimitSeconds) return;

    const deadline =
      new Date(questionStartedAt).getTime() + timeLimitSeconds * 1000;
    const now = Date.now();
    const remainingMs = Math.max(0, deadline - now);
    const remainingSec = remainingMs / 1000;
    const fraction = remainingMs / (timeLimitSeconds * 1000);

    setState({
      remaining: remainingSec,
      fraction,
      isExpired: remainingMs <= 0,
    });

    if (remainingMs > 0) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [questionStartedAt, timeLimitSeconds]);

  useEffect(() => {
    if (!questionStartedAt || !timeLimitSeconds) {
      // Timer is inactive — do NOT set isExpired to true here,
      // otherwise onExpired callbacks will fire spuriously.
      setState({ remaining: 0, fraction: 0, isExpired: false });
      return;
    }

    // Start the animation loop
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [questionStartedAt, timeLimitSeconds, tick]);

  return state;
}
