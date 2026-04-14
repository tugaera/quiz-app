// lib/timer/useServerTimer.ts — Server-synced timer with expiry callback
"use client";

import { useEffect, useRef } from "react";
import { useCountdown } from "@/hooks/useCountdown";

type UseServerTimerOptions = {
  questionStartedAt: string | null;
  timeLimitSeconds: number | null;
  onExpired?: () => void;
};

export function useServerTimer({
  questionStartedAt,
  timeLimitSeconds,
  onExpired,
}: UseServerTimerOptions) {
  const countdown = useCountdown(questionStartedAt, timeLimitSeconds);

  // Track which questionStartedAt we already fired onExpired for.
  const firedForRef = useRef<string | null>(null);

  // Generation counter: increments each time questionStartedAt changes.
  // We defer firing onExpired by a short timeout and verify the generation
  // hasn't changed — this prevents stale isExpired=true from a previous
  // question triggering onExpired for the new question.
  const generationRef = useRef(0);

  useEffect(() => {
    generationRef.current += 1;
  }, [questionStartedAt]);

  useEffect(() => {
    if (
      !countdown.isExpired ||
      !questionStartedAt ||
      !timeLimitSeconds ||
      firedForRef.current === questionStartedAt ||
      !onExpired
    ) {
      return;
    }

    const gen = generationRef.current;

    // Short defer: lets React flush the countdown state update after
    // a questionStartedAt change before we check isExpired.
    const timer = setTimeout(() => {
      if (generationRef.current !== gen) return; // questionStartedAt changed
      if (firedForRef.current === questionStartedAt) return; // already fired
      firedForRef.current = questionStartedAt;
      onExpired();
    }, 100);

    return () => clearTimeout(timer);
  }, [countdown.isExpired, questionStartedAt, timeLimitSeconds, onExpired]);

  return countdown;
}
