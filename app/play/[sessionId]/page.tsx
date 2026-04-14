// app/play/[sessionId]/page.tsx — Player join + game page
// State machine: JOINING → WAITING → PLAYING → BETWEEN_QUESTIONS → ENDED
// Does NOT require authentication — anonymous players can join via QR code.
// Player identity is persisted in sessionStorage so refreshing doesn't lose state.
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { usePlayerChannel } from "@/lib/realtime/usePlayerChannel";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import { PlayerList } from "@/components/session/PlayerList";
import type { Player, PlayerQuestion } from "@/types";
import type { QuestionEventPayload } from "@/types/realtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Helpers ────────────────────────────────────────────────
const ADJECTIVES = ["Swift", "Brave", "Clever", "Mighty", "Lucky", "Cosmic", "Jolly", "Sneaky", "Bold", "Rapid"];
const ANIMALS = ["Fox", "Eagle", "Tiger", "Panda", "Wolf", "Falcon", "Dolphin", "Owl", "Lion", "Hawk"];
function randomNickname() {
  return `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]}${ANIMALS[Math.floor(Math.random() * ANIMALS.length)]}`;
}

function getStoredPlayer(sessionId: string) {
  try {
    const raw = sessionStorage.getItem(`player:${sessionId}`);
    if (!raw) return null;
    return JSON.parse(raw) as { playerId: string; nickname: string };
  } catch {
    return null;
  }
}

function storePlayer(sessionId: string, playerId: string, nickname: string) {
  try {
    sessionStorage.setItem(`player:${sessionId}`, JSON.stringify({ playerId, nickname }));
  } catch { /* ignore */ }
}

/** Persist answer state so a page refresh doesn't lose the selection or double-count */
function getStoredAnswer(sessionId: string, questionIndex: number) {
  try {
    const raw = sessionStorage.getItem(`answer:${sessionId}:${questionIndex}`);
    if (!raw) return null;
    return JSON.parse(raw) as { selectedAnswer: number; submitted: boolean };
  } catch {
    return null;
  }
}

function storeAnswer(sessionId: string, questionIndex: number, selectedAnswer: number) {
  try {
    sessionStorage.setItem(
      `answer:${sessionId}:${questionIndex}`,
      JSON.stringify({ selectedAnswer, submitted: false })
    );
  } catch { /* ignore */ }
}

function markAnswerSubmitted(sessionId: string, questionIndex: number) {
  try {
    const raw = sessionStorage.getItem(`answer:${sessionId}:${questionIndex}`);
    if (raw) {
      const data = JSON.parse(raw);
      data.submitted = true;
      sessionStorage.setItem(`answer:${sessionId}:${questionIndex}`, JSON.stringify(data));
    }
  } catch { /* ignore */ }
}

// ─── Types ──────────────────────────────────────────────────
type GamePhase = "loading" | "joining" | "waiting" | "playing" | "between_questions" | "ended";

// ─── Component ──────────────────────────────────────────────
export default function PlayPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  // Player identity
  const [phase, setPhase] = useState<GamePhase>("loading");
  const [nickname, setNickname] = useState(randomNickname);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [joining, setJoining] = useState(false);

  // Question state
  const [questions, setQuestions] = useState<PlayerQuestion[]>([]);
  const [correctIndexes, setCorrectIndexes] = useState<Map<string, number>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionStartedAt, setQuestionStartedAt] = useState<string | null>(null);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerLocked, setAnswerLocked] = useState(false);

  const submittedRef = useRef(false);

  // ─── Fetch questions ──────────────────────────────────────
  const fetchQuestions = useCallback(async () => {
    try {
      const res = await fetch(`/api/session/${sessionId}/questions`);
      const json = await res.json();
      if (json.data) {
        setQuestions(json.data.questions);
        const ciMap = new Map<string, number>();
        for (const q of json.data.correctIndexes) {
          ciMap.set(q.id, q.correctIndex);
        }
        setCorrectIndexes(ciMap);
        return json.data.questions as PlayerQuestion[];
      }
    } catch {
      toast.error("Failed to load questions");
    }
    return [];
  }, [sessionId]);

  // ─── Fetch session state ──────────────────────────────────
  const fetchSessionState = useCallback(async () => {
    try {
      const res = await fetch(`/api/session/${sessionId}/state`);
      const json = await res.json();
      return json.data as {
        status: string;
        currentQuestionIndex: number;
        questionStartedAt: string | null;
        timeLimitSeconds: number | null;
      } | null;
    } catch {
      return null;
    }
  }, [sessionId]);

  // ─── Sync to active question from session state ───────────
  const syncToActiveQuestion = useCallback(async (state: {
    currentQuestionIndex: number;
    questionStartedAt: string | null;
    timeLimitSeconds: number | null;
  }) => {
    let qs = questions;
    if (qs.length === 0) {
      qs = await fetchQuestions();
    }
    setCurrentIndex(state.currentQuestionIndex);
    setQuestionStartedAt(state.questionStartedAt);
    setTimeLimitSeconds(state.timeLimitSeconds);

    // Restore answer state from sessionStorage (survives page refresh)
    const stored = getStoredAnswer(sessionId, state.currentQuestionIndex);
    if (stored) {
      setSelectedAnswer(stored.selectedAnswer);
      broadcastedRef.current = true; // already notified host, don't double-count

      if (stored.submitted) {
        // Timer already expired before refresh — go straight to between_questions
        submittedRef.current = true;
        setAnswerLocked(true);
        setPhase("between_questions");
      } else {
        // Had selected an answer but timer hadn't expired yet — resume playing
        setAnswerLocked(false);
        submittedRef.current = false;
        setPhase("playing");
      }
    } else {
      // No stored answer — fresh question
      setSelectedAnswer(null);
      setAnswerLocked(false);
      submittedRef.current = false;
      broadcastedRef.current = false;
      setPhase("playing");
    }
  }, [questions, fetchQuestions, sessionId]);

  // ─── On mount: check stored player, fetch session state ───
  useEffect(() => {
    const init = async () => {
      const stored = getStoredPlayer(sessionId);
      const state = await fetchSessionState();

      if (!state) {
        setPhase("joining");
        return;
      }

      if (state.status === "ended") {
        setPhase("ended");
        return;
      }

      // If we have a stored player, try to rejoin
      if (stored) {
        try {
          const res = await fetch(`/api/session/${sessionId}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              playerId: stored.playerId,
              nickname: stored.nickname,
            }),
          });
          const json = await res.json();

          if (json.data?.rejoined) {
            setPlayerId(json.data.player.id);
            setNickname(stored.nickname);
            setPlayers(json.data.players as Player[]);

            if (state.status === "active" && state.questionStartedAt) {
              await syncToActiveQuestion(state);
            } else {
              setPhase("waiting");
            }
            return;
          }
        } catch {
          // stored player invalid — fall through to join screen
        }
      }

      // No stored player or rejoin failed
      setPhase("joining");
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ─── Handle joining ───────────────────────────────────────
  const handleJoin = async () => {
    setJoining(true);

    try {
      const res = await fetch(`/api/session/${sessionId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim() || randomNickname() }),
      });
      const json = await res.json();

      if (json.error) {
        toast.error(json.error);
        setJoining(false);
        return;
      }

      const pid = json.data.player.id;
      const pnick = json.data.player.nickname;
      setPlayerId(pid);
      setPlayers(json.data.players as Player[]);
      storePlayer(sessionId, pid, pnick);

      // Check current session state
      const state = await fetchSessionState();
      if (state?.status === "active" && state.questionStartedAt) {
        await syncToActiveQuestion(state);
      } else {
        setPhase("waiting");
      }
    } catch {
      toast.error("Failed to join. Please try again.");
    }

    setJoining(false);
  };

  // ─── Handle broadcast: question event ─────────────────────
  const handleQuestionEvent = useCallback(
    (payload: QuestionEventPayload) => {
      // Reset answer state for the new question
      setSelectedAnswer(null);
      setAnswerLocked(false);
      submittedRef.current = false;
      broadcastedRef.current = false;

      setCurrentIndex(payload.questionIndex);
      setQuestionStartedAt(payload.questionStartedAt);
      setTimeLimitSeconds(payload.timeLimitSeconds);

      if (questions.length === 0) {
        fetchQuestions().then(() => setPhase("playing"));
      } else {
        setPhase("playing");
      }
    },
    [questions.length, fetchQuestions]
  );

  // ─── Realtime subscriptions ───────────────────────────────
  const playerChannelRef = usePlayerChannel(sessionId, {
    onQuizStart: handleQuestionEvent,
    onNextQuestion: handleQuestionEvent,
    onQuizEnd: () => setPhase("ended"),
    onPlayerJoined: (player) => {
      setPlayers((prev) =>
        prev.some((p) => p.id === player.id) ? prev : [...prev, player]
      );
    },
  });

  // Track whether we already broadcast answer_submitted for this question
  // (so the host only counts once per player per question)
  const broadcastedRef = useRef(false);

  // ─── Notify host when player first selects an answer ──────
  const notifyHostOfSelection = useCallback(() => {
    if (broadcastedRef.current) return;
    broadcastedRef.current = true;
    if (playerChannelRef.current) {
      playerChannelRef.current.send({
        type: "broadcast",
        event: "answer_submitted",
        payload: { playerId },
      });
    }
  }, [playerId, playerChannelRef]);

  // Refs for latest values — so handleTimerExpired never uses stale closures
  const selectedAnswerRef = useRef(selectedAnswer);
  selectedAnswerRef.current = selectedAnswer;
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const questionStartedAtLocalRef = useRef(questionStartedAt);
  questionStartedAtLocalRef.current = questionStartedAt;
  const correctIndexesRef = useRef(correctIndexes);
  correctIndexesRef.current = correctIndexes;

  // ─── Timer expired: submit the final answer ───────────────
  // Uses refs exclusively so the callback identity is stable and
  // always reads the freshest state — no stale closure issues.
  const handleTimerExpired = useCallback(async () => {
    if (submittedRef.current || !playerId) {
      setPhase("between_questions");
      return;
    }
    submittedRef.current = true;
    setAnswerLocked(true);

    const idx = currentIndexRef.current;
    const question = questions[idx];
    if (!question) {
      setPhase("between_questions");
      return;
    }

    const finalAnswer = selectedAnswerRef.current;
    const qStartedAt = questionStartedAtLocalRef.current;
    const responseTimeMs = qStartedAt
      ? Date.now() - new Date(qStartedAt).getTime()
      : null;

    const correctIdx = correctIndexesRef.current.get(question.id);
    const isCorrect = finalAnswer !== null && finalAnswer === correctIdx;

    try {
      await fetch(`/api/session/${sessionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          questionId: question.id,
          selectedIndex: finalAnswer,
          isCorrect,
          responseTimeMs,
        }),
      });

      // Also notify host if we hadn't already
      notifyHostOfSelection();
    } catch {
      // Swallow — answer may still have been recorded
    }

    markAnswerSubmitted(sessionId, currentIndexRef.current);
    setPhase("between_questions");
  }, [playerId, questions, sessionId, notifyHostOfSelection]);

  // ─── Polling fallback ─────────────────────────────────────
  // If in waiting or between_questions, poll every 2s for state changes
  // in case a broadcast was missed.
  const questionStartedAtRef = useRef(questionStartedAt);
  questionStartedAtRef.current = questionStartedAt;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const questionsRef = useRef(questions);
  questionsRef.current = questions;

  useEffect(() => {
    if (phase !== "waiting" && phase !== "between_questions") return;
    if (!playerId) return;

    const poll = async () => {
      const state = await fetchSessionState();
      if (!state) return;

      if (state.status === "ended") {
        setPhase("ended");
        return;
      }

      if (
        state.status === "active" &&
        state.questionStartedAt &&
        state.questionStartedAt !== questionStartedAtRef.current
      ) {
        // New question detected via polling
        let qs = questionsRef.current;
        if (qs.length === 0) {
          qs = await fetchQuestions();
        }
        setCurrentIndex(state.currentQuestionIndex);
        setQuestionStartedAt(state.questionStartedAt);
        setTimeLimitSeconds(state.timeLimitSeconds);
        setSelectedAnswer(null);
        setAnswerLocked(false);
        submittedRef.current = false;
        broadcastedRef.current = false;
        setPhase("playing");
      }
    };

    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [phase, playerId, fetchSessionState, fetchQuestions]);

  // ─── Render ───────────────────────────────────────────────

  // Loading
  if (phase === "loading") {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-48 w-full" />
        </div>
      </main>
    );
  }

  // Ended
  if (phase === "ended") {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Quiz Complete!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Thanks for playing!</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Joining
  if (phase === "joining") {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Join Quiz</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nickname</label>
              <Input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Enter your nickname"
                maxLength={30}
              />
            </div>
            <Button
              onClick={handleJoin}
              className="w-full"
              disabled={joining || !nickname.trim()}
            >
              {joining ? "Joining..." : "Ready!"}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Waiting
  if (phase === "waiting") {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Waiting for host to start...</CardTitle>
          </CardHeader>
          <CardContent>
            <PlayerList players={players} />
          </CardContent>
        </Card>
      </main>
    );
  }

  // Between questions
  if (phase === "between_questions") {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12">
            <div className="animate-pulse space-y-4">
              <p className="text-xl font-semibold">Answer submitted!</p>
              <p className="text-muted-foreground">Waiting for next question...</p>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Playing
  const currentQuestion = questions[currentIndex];
  if (!currentQuestion || !questionStartedAt || !timeLimitSeconds) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <Skeleton className="h-64 w-full max-w-2xl" />
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <QuestionCard
        question={currentQuestion}
        questionIndex={currentIndex}
        totalQuestions={questions.length}
        questionStartedAt={questionStartedAt}
        timeLimitSeconds={timeLimitSeconds}
        selectedAnswer={selectedAnswer}
        disabled={answerLocked}
        onSelectAnswer={(index) => {
          if (!answerLocked) {
            setSelectedAnswer(index);
            storeAnswer(sessionId, currentIndex, index);
            notifyHostOfSelection();
          }
        }}
        onTimerExpired={handleTimerExpired}
      />
    </main>
  );
}
