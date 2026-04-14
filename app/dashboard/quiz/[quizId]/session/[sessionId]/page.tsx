// app/dashboard/quiz/[quizId]/session/[sessionId]/page.tsx — Host live dashboard
// The host is responsible for advancing questions when the timer expires.
// This ensures progression works even without the Edge Function running.
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useHostChannel } from "@/lib/realtime/useHostChannel";
import { useServerTimer } from "@/lib/timer/useServerTimer";
import { PlayerList } from "@/components/session/PlayerList";
import { AnswerStats } from "@/components/session/AnswerStats";
import { QRModal } from "@/components/quiz/QRModal";
import type { Player, Question, QuizSession } from "@/types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function HostDashboardPage() {
  const params = useParams<{ quizId: string; sessionId: string }>();
  const router = useRouter();

  const [session, setSession] = useState<QuizSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [answerCount, setAnswerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);

  // Track if we're currently advancing to prevent double-fires
  const advancingRef = useRef(false);

  // Persistent broadcast channel — must be subscribed before we can send
  const broadcastChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(`quiz:${params.sessionId}`);
    channel.subscribe();
    broadcastChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      broadcastChannelRef.current = null;
    };
  }, [params.sessionId]);

  const fetchData = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();

    const { data: sessionData } = await supabase
      .from("quiz_sessions")
      .select("*")
      .eq("id", params.sessionId)
      .single();

    if (!sessionData) {
      toast.error("Session not found");
      router.push("/dashboard");
      return;
    }
    setSession(sessionData as QuizSession);

    const { data: questionsData } = await supabase
      .from("questions")
      .select("*")
      .eq("quiz_id", params.quizId)
      .order("order_index", { ascending: true });
    setQuestions((questionsData ?? []) as Question[]);

    const { data: playersData } = await supabase
      .from("players")
      .select("*")
      .eq("session_id", params.sessionId);
    setPlayers(playersData ?? []);

    // Count answers for current question
    if (sessionData.status === "active" && questionsData) {
      const currentQ = questionsData[sessionData.current_question_index];
      if (currentQ) {
        const { count } = await supabase
          .from("answers")
          .select("id", { count: "exact", head: true })
          .eq("session_id", params.sessionId)
          .eq("question_id", currentQ.id);
        setAnswerCount(count ?? 0);
      }
    }

    setLoading(false);
  }, [params.sessionId, params.quizId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Auto-advance when timer expires ─────────────────────────
  // The host dashboard is the authority for advancing questions.
  // When the timer hits 0, we update the DB and broadcast the event.
  const advanceToNextQuestion = useCallback(async () => {
    if (!session || session.status !== "active" || advancingRef.current) return;
    advancingRef.current = true;

    const supabase = getSupabaseBrowserClient();
    const nextIndex = session.current_question_index + 1;
    const hasMore = nextIndex < questions.length;

    if (hasMore) {
      const nextQuestion = questions[nextIndex];
      const now = new Date().toISOString();

      // Update DB
      const { error } = await supabase
        .from("quiz_sessions")
        .update({
          current_question_index: nextIndex,
          question_started_at: now,
        })
        .eq("id", params.sessionId);

      if (error) {
        toast.error("Failed to advance: " + error.message);
        advancingRef.current = false;
        return;
      }

      // Broadcast to all players via persistent channel
      if (broadcastChannelRef.current) {
        await broadcastChannelRef.current.send({
          type: "broadcast",
          event: "next_question",
          payload: {
            questionIndex: nextIndex,
            questionStartedAt: now,
            timeLimitSeconds: nextQuestion.time_limit_seconds,
          },
        });
      }

      // Update local state
      setSession((prev) =>
        prev
          ? {
              ...prev,
              current_question_index: nextIndex,
              question_started_at: now,
            }
          : prev
      );
      setAnswerCount(0);
    } else {
      // No more questions — end the quiz
      const now = new Date().toISOString();

      await supabase
        .from("quiz_sessions")
        .update({
          status: "ended",
          ended_at: now,
          question_started_at: null,
        })
        .eq("id", params.sessionId);

      // Broadcast quiz_end via persistent channel
      if (broadcastChannelRef.current) {
        await broadcastChannelRef.current.send({
          type: "broadcast",
          event: "quiz_end",
          payload: {},
        });
      }

      setSession((prev) =>
        prev ? { ...prev, status: "ended", question_started_at: null } : prev
      );
    }

    advancingRef.current = false;
  }, [session, questions, params.sessionId]);

  // Get the current question's time limit for the timer
  const currentQuestion =
    session?.status === "active"
      ? questions[session.current_question_index]
      : null;

  // Server timer — calls advanceToNextQuestion when it expires
  const { remaining, fraction } = useServerTimer({
    questionStartedAt: session?.question_started_at ?? null,
    timeLimitSeconds: currentQuestion?.time_limit_seconds ?? null,
    onExpired: advanceToNextQuestion,
  });

  // ─── Realtime subscriptions ──────────────────────────────────
  useHostChannel(params.sessionId, {
    onNextQuestion: (payload) => {
      // Another source (Edge Function) advanced the question
      setSession((prev) =>
        prev
          ? {
              ...prev,
              current_question_index: payload.questionIndex,
              question_started_at: payload.questionStartedAt,
              status: "active",
            }
          : prev
      );
      setAnswerCount(0);
    },
    onQuizEnd: () => {
      setSession((prev) =>
        prev ? { ...prev, status: "ended", question_started_at: null } : prev
      );
    },
    onPlayerJoined: (player) => {
      setPlayers((prev) =>
        prev.some((p) => p.id === player.id) ? prev : [...prev, player]
      );
    },
    onAnswerSubmitted: () => {
      setAnswerCount((prev) => prev + 1);
    },
  });

  // ─── Host actions ────────────────────────────────────────────
  const startQuiz = async () => {
    if (questions.length === 0) {
      toast.error("No questions to start");
      return;
    }
    setStarting(true);

    const supabase = getSupabaseBrowserClient();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("quiz_sessions")
      .update({
        status: "active",
        current_question_index: 0,
        question_started_at: now,
      })
      .eq("id", params.sessionId);

    if (error) {
      toast.error(error.message);
      setStarting(false);
      return;
    }

    // Broadcast quiz_start via persistent channel
    if (broadcastChannelRef.current) {
      await broadcastChannelRef.current.send({
        type: "broadcast",
        event: "quiz_start",
        payload: {
          questionIndex: 0,
          questionStartedAt: now,
          timeLimitSeconds: questions[0].time_limit_seconds,
        },
      });
    }

    setSession((prev) =>
      prev
        ? {
            ...prev,
            status: "active",
            current_question_index: 0,
            question_started_at: now,
          }
        : prev
    );
    setAnswerCount(0);
    setStarting(false);
  };

  const endQuizEarly = async () => {
    setEnding(true);
    const supabase = getSupabaseBrowserClient();

    await supabase
      .from("quiz_sessions")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
        question_started_at: null,
      })
      .eq("id", params.sessionId);

    if (broadcastChannelRef.current) {
      await broadcastChannelRef.current.send({
        type: "broadcast",
        event: "quiz_end",
        payload: {},
      });
    }

    setSession((prev) =>
      prev ? { ...prev, status: "ended", question_started_at: null } : prev
    );
    setEnding(false);
  };

  // ─── Render ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!session) return null;

  // Timer bar color: green → yellow → red
  const timerColor =
    fraction > 0.5
      ? "bg-green-500"
      : fraction > 0.25
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Host Dashboard</h1>
          <Badge
            variant={
              session.status === "active"
                ? "default"
                : session.status === "ended"
                  ? "secondary"
                  : "outline"
            }
          >
            {session.status}
          </Badge>
        </div>
        <div className="flex gap-2">
          {session.status === "waiting" && (
            <>
              <QRModal sessionId={session.id} />
              <Button onClick={startQuiz} disabled={starting || questions.length === 0}>
                {starting ? "Starting..." : "Start Quiz"}
              </Button>
            </>
          )}
          {session.status === "active" && (
            <Button variant="destructive" onClick={endQuizEarly} disabled={ending}>
              {ending ? "Ending..." : "End Quiz Early"}
            </Button>
          )}
          {session.status === "ended" && (
            <Button
              onClick={() =>
                router.push(
                  `/dashboard/quiz/${params.quizId}/session/${params.sessionId}/results`
                )
              }
            >
              View Results
            </Button>
          )}
        </div>
      </div>

      {/* ── Active quiz: full-width question display for screen sharing ── */}
      {session.status === "active" && currentQuestion ? (
        <div className="space-y-4">
          {/* Timer bar */}
          <div className="space-y-1">
            <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${timerColor}`}
                style={{ width: `${Math.max(0, fraction * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                Question {session.current_question_index + 1} of {questions.length}
              </span>
              <span className="tabular-nums font-medium">{Math.ceil(remaining)}s</span>
            </div>
          </div>

          {/* Question text */}
          <Card>
            <CardContent className="py-8">
              <p className="text-2xl font-bold text-center">{currentQuestion.text}</p>
            </CardContent>
          </Card>

          {/* Answer options — no correct highlight during quiz */}
          <div className="grid grid-cols-2 gap-3">
            {(currentQuestion.answers as string[]).map((answer, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-4 rounded-lg border-2 border-border bg-muted text-foreground font-semibold text-lg min-h-[64px]"
              >
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-background border-2 border-border flex items-center justify-center text-sm font-bold">
                  {String.fromCharCode(65 + i)}
                </span>
                <span>{answer}</span>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="py-4">
                <AnswerStats
                  submittedCount={answerCount}
                  totalPlayers={players.length}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Players ({players.length})</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <PlayerList players={players} />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Waiting / Ended state */}
          <Card>
            <CardHeader>
              <CardTitle>
                {session.status === "waiting" ? "Waiting to Start" : "Quiz Ended"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {session.status === "waiting" && (
                <p className="text-muted-foreground text-sm">
                  {players.length === 0
                    ? "Share the QR code so players can join."
                    : `${players.length} player${players.length === 1 ? "" : "s"} ready.`}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Players ({players.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <PlayerList players={players} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
