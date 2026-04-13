// components/session/Leaderboard.tsx — Final leaderboard with scoring
"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export type LeaderboardEntry = {
  nickname: string;
  correctCount: number;
  totalScore: number;
  rank: number;
};

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

const RANK_STYLES: Record<number, string> = {
  1: "text-yellow-600 font-bold",
  2: "text-gray-500 font-bold",
  3: "text-amber-700 font-bold",
};

export function Leaderboard({ entries }: LeaderboardProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-center">Leaderboard</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Rank</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-right">Correct</TableHead>
            <TableHead className="text-right">Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.nickname}>
              <TableCell className={RANK_STYLES[entry.rank] ?? ""}>
                {entry.rank <= 3 ? (
                  <Badge
                    variant={entry.rank === 1 ? "default" : "secondary"}
                    className="w-8 justify-center"
                  >
                    {entry.rank}
                  </Badge>
                ) : (
                  entry.rank
                )}
              </TableCell>
              <TableCell className="font-medium">{entry.nickname}</TableCell>
              <TableCell className="text-right">{entry.correctCount}</TableCell>
              <TableCell className="text-right font-mono">
                {entry.totalScore.toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
