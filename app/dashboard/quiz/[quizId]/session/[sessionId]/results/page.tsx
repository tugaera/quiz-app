// app/dashboard/quiz/[quizId]/session/[sessionId]/results/page.tsx — Results view
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Leaderboard, type LeaderboardEntry } from "@/components/session/Leaderboard";
import type { Question, Answer, Player } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Scoring: 1000 base for correct + up to 500 speed bonus */
function calculateScore(answer: Answer, timeLimitSeconds: number): number {
  if (!answer.is_correct) return 0;
  const base = 1000;
  const speedBonus = answer.response_time_ms
    ? Math.round(500 * Math.max(0, 1 - answer.response_time_ms / (timeLimitSeconds * 1000)))
    : 0;
  return base + speedBonus;
}

type QuestionResult = {
  question: Question;
  answerCounts: number[];
  correctIndex: number;
  fastestCorrect: { nickname: string; timeMs: number } | null;
  totalPlayers: number;
  totalResponses: number;
};

export default function ResultsPage() {
  const params = useParams<{ quizId: string; sessionId: string }>();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewIndex, setViewIndex] = useState(-1); // -1 = leaderboard

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/session/${params.sessionId}/results`);
      const json = await res.json();

      if (json.error) {
        toast.error(json.error);
        setLoading(false);
        return;
      }

      setQuestions(json.data.questions as Question[]);
      setAnswers(json.data.answers as Answer[]);
      setPlayers(json.data.players as Player[]);
    } catch {
      toast.error("Failed to load results");
    }
    setLoading(false);
  }, [params.sessionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 mx-auto" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <h1 className="text-2xl font-bold">Results</h1>
        <p className="text-muted-foreground">
          No question data available for this session.
          {answers.length > 0 && " The quiz questions may have been edited after this session."}
        </p>
      </div>
    );
  }

  // Build leaderboard
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  const playerScores = new Map<string, { correct: number; total: number }>();
  for (const answer of answers) {
    const q = questionMap.get(answer.question_id);
    if (!q) continue;
    const score = calculateScore(answer, q.time_limit_seconds);
    const existing = playerScores.get(answer.player_id) ?? { correct: 0, total: 0 };
    playerScores.set(answer.player_id, {
      correct: existing.correct + (answer.is_correct ? 1 : 0),
      total: existing.total + score,
    });
  }

  const leaderboard: LeaderboardEntry[] = Array.from(playerScores.entries())
    .map(([playerId, scores]) => ({
      nickname: playerMap.get(playerId)?.nickname ?? "Unknown",
      correctCount: scores.correct,
      totalScore: scores.total,
      rank: 0,
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((entry, i) => ({ ...entry, rank: i + 1 }))
    .slice(0, 10);

  // Build per-question results
  const getQuestionResult = (qIndex: number): QuestionResult => {
    const question = questions[qIndex];
    const qAnswers = answers.filter((a) => a.question_id === question.id);
    const answerOptions = question.answers as string[];
    const answerCounts = new Array(answerOptions.length).fill(0);
    let fastestCorrect: QuestionResult["fastestCorrect"] = null;

    for (const a of qAnswers) {
      if (a.selected_index !== null && a.selected_index < answerCounts.length) {
        answerCounts[a.selected_index]++;
      }
      if (a.is_correct && a.response_time_ms !== null) {
        if (!fastestCorrect || a.response_time_ms < fastestCorrect.timeMs) {
          fastestCorrect = {
            nickname: playerMap.get(a.player_id)?.nickname ?? "Unknown",
            timeMs: a.response_time_ms,
          };
        }
      }
    }

    const totalResponses = qAnswers.length;
    return { question, answerCounts, correctIndex: question.correct_index, fastestCorrect, totalPlayers: players.length, totalResponses };
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Results</h1>
        <div className="flex justify-center gap-4 text-sm text-muted-foreground">
          <span>{players.length} participants</span>
          <span>{questions.length} questions</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <Button
          variant={viewIndex === -1 ? "default" : "outline"}
          size="sm"
          onClick={() => setViewIndex(-1)}
        >
          Leaderboard
        </Button>
        {questions.map((_, i) => (
          <Button
            key={i}
            variant={viewIndex === i ? "default" : "outline"}
            size="sm"
            onClick={() => setViewIndex(i)}
          >
            Q{i + 1}
          </Button>
        ))}
      </div>

      {/* Content */}
      {viewIndex === -1 ? (
        <Leaderboard entries={leaderboard} />
      ) : (
        <QuestionResultView result={getQuestionResult(viewIndex)} />
      )}
    </div>
  );
}

function QuestionResultView({ result }: { result: QuestionResult }) {
  const answerOptions = result.question.answers as string[];
  const answered = result.answerCounts.reduce((sum, c) => sum + c, 0);
  const notAnswered = result.totalPlayers - result.totalResponses;
  const total = result.totalPlayers;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{result.question.text}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {answerOptions.map((answer, i) => {
          const count = result.answerCounts[i];
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const isCorrect = i === result.correctIndex;

          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  {answer}
                  {isCorrect && (
                    <Badge variant="default" className="text-xs">
                      Correct
                    </Badge>
                  )}
                </span>
                <span className="text-muted-foreground">
                  {count} ({pct}%)
                </span>
              </div>
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${isCorrect ? "bg-green-500" : "bg-muted-foreground/30"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}

        {/* Not answered */}
        {notAnswered > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground italic">No answer</span>
              <span className="text-muted-foreground">
                {notAnswered} ({total > 0 ? Math.round((notAnswered / total) * 100) : 0}%)
              </span>
            </div>
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-muted-foreground/15"
                style={{ width: `${total > 0 ? Math.round((notAnswered / total) * 100) : 0}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>{answered} answered</span>
          <span>{notAnswered} not answered</span>
          <span>{total} total players</span>
        </div>

        {result.fastestCorrect && (
          <p className="text-sm text-muted-foreground mt-2">
            Fastest correct: <strong>{result.fastestCorrect.nickname}</strong> (
            {(result.fastestCorrect.timeMs / 1000).toFixed(2)}s)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
