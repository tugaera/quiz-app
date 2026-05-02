// hooks/useCountdown.ts — requestAnimationFrame-based countdown
// Derives remaining time from a server-provided start timestamp.
"use client";

import { useEffect, useRef, useState } from "react";

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
  timeLimitSeconds: number | null,
  /** estimatedServerNow − local Date.now(); corrects phones with wrong system time */
  clockSkewMs: number
): CountdownState {
  if (!questionStartedAt || !timeLimitSeconds) {
    return { remaining: 0, fraction: 0, isExpired: false };
  }
  const deadline =
    new Date(questionStartedAt).getTime() + timeLimitSeconds * 1000;
  const adjustedNow = Date.now() + clockSkewMs;
  const remainingMs = Math.max(0, deadline - adjustedNow);
  return {
    remaining: remainingMs / 1000,
    fraction: Math.min(1, remainingMs / (timeLimitSeconds * 1000)),
    isExpired: remainingMs <= 0,
  };
}

export function useCountdown(
  questionStartedAt: string | null,
  timeLimitSeconds: number | null,
  clockSkewMs = 0
): CountdownState {
  // Compute initial state from reality, not a hardcoded default
  const [state, setState] = useState<CountdownState>(() =>
    computeState(questionStartedAt, timeLimitSeconds, clockSkewMs)
  );
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!questionStartedAt || !timeLimitSeconds) {
      setState({ remaining: 0, fraction: 0, isExpired: false });
      return;
    }

    // Locals for closures — TS does not narrow outer props inside nested `tick`
    const startedAt = questionStartedAt;
    const limitSeconds = timeLimitSeconds;

    // Immediately compute the real state (important for SSR → client handoff)
    const initial = computeState(startedAt, limitSeconds, clockSkewMs);
    setState(initial);

    if (initial.isExpired) return;

    // Inner function avoids "tick used before declaration" with useCallback + rAF recursion
    function tick(): void {
      const deadline =
        new Date(startedAt).getTime() + limitSeconds * 1000;
      const adjustedNow = Date.now() + clockSkewMs;
      const remainingMs = Math.max(0, deadline - adjustedNow);

      setState({
        remaining: remainingMs / 1000,
        fraction: Math.min(1, remainingMs / (limitSeconds * 1000)),
        isExpired: remainingMs <= 0,
      });

      if (remainingMs > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [questionStartedAt, timeLimitSeconds, clockSkewMs]);

  return state;
}
