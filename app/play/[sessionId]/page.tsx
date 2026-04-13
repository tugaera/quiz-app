// app/play/[sessionId]/page.tsx — Player join + game page
// State machine: JOINING → WAITING → PLAYING → BETWEEN_QUESTIONS → ENDED
// Does NOT require authentication — anonymous players can join via QR code.
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useSessionState } from "@/hooks/useSessionState";
import { usePlayerChannel } from "@/lib/realtime/usePlayerChannel";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import { PlayerList } from "@/components/session/PlayerList";
import type { Player, PlayerQuestion } from "@/types";
import type { QuestionEventPayload } from "@/types/realtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Random nickname generator
const ADJECTIVES = ["Swift", "Brave", "Clever", "Mighty", "Lucky", "Cosmic", "Jolly", "Sneaky", "Bold", "Rapid"];
const ANIMALS = ["Fox", "Eagle", "Tiger", "Panda", "Wolf", "Falcon", "Dolphin", "Owl", "Lion", "Hawk"];
function randomNickname() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const ani = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj}${ani}`;
}

type GamePhase = "joining" | "waiting" | "playing" | "between_questions" | "ended";

export default function PlayPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const { state: sessionState, loading: stateLoading } = useSessionState(sessionId);

  // Player state
  const [phase, setPhase] = useState<GamePhase>("joining");
  const [nickname, setNickname] = useState(randomNickname);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [joining, setJoining] = useState(false);

  // Question state — includes correct_index fetched via admin for scoring
  const [questions, setQuestions] = useState<PlayerQuestion[]>([]);
  const [correctIndexes, setCorrectIndexes] = useState<Map<string, number>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionStartedAt, setQuestionStartedAt] = useState<string | null>(null);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerLocked, setAnswerLocked] = useState(false);

  const submittedRef = useRef(false);

  // Fetch questions (uses admin API route to bypass RLS for anonymous players)
  const fetchQuestions = useCallback(async () => {
    try {
      const res = await fetch(`/api/session/${sessionId}/questions`);
      const json = await res.json();
      if (json.data) {
        setQuestions(json.data.questions);
        // Store correct indexes for scoring when submitting
        const ciMap = new Map<string, number>();
        for (const q of json.data.correctIndexes) {
          ciMap.set(q.id, q.correctIndex);
        }
        setCorrectIndexes(ciMap);
      }
    } catch {
      toast.error("Failed to load questions");
    }
  }, [sessionId]);

  // Sync initial session state
  useEffect(() => {
    if (!sessionState || phase !== "joining") return;

    if (sessionState.status === "ended") {
      setPhase("ended");
    }
  }, [sessionState, phase]);

  // Handle joining — uses API route so no auth is required
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

      setPlayerId(json.data.player.id);
      setPlayers(json.data.players as Player[]);

      // Determine phase based on session state
      if (sessionState?.status === "active") {
        await fetchQuestions();
        setCurrentIndex(sessionState.currentQuestionIndex);
        setQuestionStartedAt(sessionState.questionStartedAt);
        setTimeLimitSeconds(sessionState.timeLimitSeconds);
        setAnswerLocked(sessionState.alreadyAnswered);
        if (sessionState.alreadyAnswered) {
          setPhase("between_questions");
        } else {
          setPhase("playing");
        }
      } else {
        setPhase("waiting");
      }
    } catch {
      toast.error("Failed to join. Please try again.");
    }

    setJoining(false);
  };

  // Handle question event (start or next)
  const handleQuestionEvent = useCallback(
    (payload: QuestionEventPayload) => {
      setCurrentIndex(payload.questionIndex);
      setQuestionStartedAt(payload.questionStartedAt);
      setTimeLimitSeconds(payload.timeLimitSeconds);
      setSelectedAnswer(null);
      setAnswerLocked(false);
      submittedRef.current = false;

      if (questions.length === 0) {
        fetchQuestions().then(() => setPhase("playing"));
      } else {
        setPhase("playing");
      }
    },
    [questions.length, fetchQuestions]
  );

  // Realtime subscriptions
  usePlayerChannel(sessionId, {
    onQuizStart: handleQuestionEvent,
    onNextQuestion: handleQuestionEvent,
    onQuizEnd: () => setPhase("ended"),
    onPlayerJoined: (player) => {
      setPlayers((prev) =>
        prev.some((p) => p.id === player.id) ? prev : [...prev, player]
      );
    },
  });

  // Submit answer when timer expires — uses API route so no auth is required
  const handleTimerExpired = useCallback(async () => {
    if (submittedRef.current || !playerId) return;
    submittedRef.current = true;
    setAnswerLocked(true);

    const question = questions[currentIndex];
    if (!question) {
      setPhase("between_questions");
      return;
    }

    // Calculate response time
    const responseTimeMs = questionStartedAt
      ? Date.now() - new Date(questionStartedAt).getTime()
      : null;

    // Determine correctness from the stored correct indexes
    const correctIdx = correctIndexes.get(question.id);
    const isCorrect = selectedAnswer !== null && selectedAnswer === correctIdx;

    try {
      const res = await fetch(`/api/session/${sessionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          questionId: question.id,
          selectedIndex: selectedAnswer,
          isCorrect,
          responseTimeMs,
        }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error("Failed to submit answer");
      }
    } catch {
      toast.error("Failed to submit answer");
    }

    setPhase("between_questions");
  }, [playerId, questions, currentIndex, selectedAnswer, questionStartedAt, sessionId, correctIndexes]);

  // Loading state
  if (stateLoading) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-48 w-full" />
        </div>
      </main>
    );
  }

  // ENDED phase
  if (phase === "ended" || sessionState?.status === "ended") {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Quiz Complete!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Thanks for playing!
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  // JOINING phase
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

  // WAITING phase
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

  // BETWEEN_QUESTIONS phase
  if (phase === "between_questions") {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12">
            <div className="animate-pulse space-y-4">
              <p className="text-xl font-semibold">Answer submitted!</p>
              <p className="text-muted-foreground">
                Waiting for next question...
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  // PLAYING phase
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
          if (!answerLocked) setSelectedAnswer(index);
        }}
        onTimerExpired={handleTimerExpired}
      />
    </main>
  );
}
