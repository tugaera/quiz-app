// components/quiz/TimerBar.tsx — Animated timer bar synced to server timestamp
"use client";

import { useServerTimer } from "@/lib/timer/useServerTimer";
import { cn } from "@/lib/utils";

interface TimerBarProps {
  questionStartedAt: string | null;
  timeLimitSeconds: number | null;
  onExpired?: () => void;
  className?: string;
}

export function TimerBar({
  questionStartedAt,
  timeLimitSeconds,
  onExpired,
  className,
}: TimerBarProps) {
  const { remaining, fraction } = useServerTimer({
    questionStartedAt,
    timeLimitSeconds,
    onExpired,
  });

  // Color transitions: green → yellow → red
  const color =
    fraction > 0.5
      ? "bg-green-500"
      : fraction > 0.25
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className={cn("w-full space-y-1", className)}>
      <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full", color)}
          style={{ width: `${Math.max(0, fraction * 100)}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground text-right tabular-nums">
        {Math.ceil(remaining)}s
      </p>
    </div>
  );
}
