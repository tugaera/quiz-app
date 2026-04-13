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
  // Track whether we've seen a non-expired state for the current question.
  // This prevents stale isExpired=true from a previous question
  // from immediately firing onExpired for the new question.
  const sawRunningRef = useRef(false);

  // When questionStartedAt changes, reset the "saw running" flag
  useEffect(() => {
    sawRunningRef.current = false;
  }, [questionStartedAt]);

  useEffect(() => {
    // Once we see isExpired=false for the current question, mark it as "running"
    if (!countdown.isExpired && questionStartedAt) {
      sawRunningRef.current = true;
    }

    if (
      countdown.isExpired &&
      sawRunningRef.current &&
      questionStartedAt &&
      timeLimitSeconds &&
      firedForRef.current !== questionStartedAt &&
      onExpired
    ) {
      firedForRef.current = questionStartedAt;
      onExpired();
    }
  }, [countdown.isExpired, questionStartedAt, timeLimitSeconds, onExpired]);

  return countdown;
}
