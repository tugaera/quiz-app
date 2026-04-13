// components/session/AnswerStats.tsx — Live answer submission count
"use client";

interface AnswerStatsProps {
  submittedCount: number;
  totalPlayers: number;
}

export function AnswerStats({ submittedCount, totalPlayers }: AnswerStatsProps) {
  const percentage =
    totalPlayers > 0 ? Math.round((submittedCount / totalPlayers) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Answers submitted</span>
        <span className="font-medium">
          {submittedCount} / {totalPlayers}
        </span>
      </div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
