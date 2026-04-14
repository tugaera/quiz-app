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

function computeState(
  questionStartedAt: string | null,
  timeLimitSeconds: number | null
): CountdownState {
  if (!questionStartedAt || !timeLimitSeconds) {
    return { remaining: 0, fraction: 0, isExpired: false };
  }
  const deadline =
    new Date(questionStartedAt).getTime() + timeLimitSeconds * 1000;
  const remainingMs = Math.max(0, deadline - Date.now());
  return {
    remaining: remainingMs / 1000,
    fraction: Math.min(1, remainingMs / (timeLimitSeconds * 1000)),
    isExpired: remainingMs <= 0,
  };
}

export function useCountdown(
  questionStartedAt: string | null,
  timeLimitSeconds: number | null
): CountdownState {
  // Compute initial state from reality, not a hardcoded default
  const [state, setState] = useState<CountdownState>(() =>
    computeState(questionStartedAt, timeLimitSeconds)
  );
  const rafRef = useRef<number>(0);

  const tick = useCallback(() => {
    if (!questionStartedAt || !timeLimitSeconds) return;

    const deadline =
      new Date(questionStartedAt).getTime() + timeLimitSeconds * 1000;
    const now = Date.now();
    const remainingMs = Math.max(0, deadline - now);

    setState({
      remaining: remainingMs / 1000,
      fraction: Math.min(1, remainingMs / (timeLimitSeconds * 1000)),
      isExpired: remainingMs <= 0,
    });

    if (remainingMs > 0) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [questionStartedAt, timeLimitSeconds]);

  useEffect(() => {
    if (!questionStartedAt || !timeLimitSeconds) {
      setState({ remaining: 0, fraction: 0, isExpired: false });
      return;
    }

    // Immediately compute the real state (important for SSR → client handoff)
    const initial = computeState(questionStartedAt, timeLimitSeconds);
    setState(initial);

    // Only start the RAF loop if there's time remaining
    if (!initial.isExpired) {
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [questionStartedAt, timeLimitSeconds, tick]);

  return state;
}
