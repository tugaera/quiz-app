// components/quiz/QuestionCard.tsx — Displays question with answer options
"use client";

import { AnswerButton } from "./AnswerButton";
import { TimerBar } from "./TimerBar";
import type { PlayerQuestion } from "@/types";

interface QuestionCardProps {
  question: PlayerQuestion;
  questionIndex: number;
  totalQuestions: number;
  questionStartedAt: string;
  timeLimitSeconds: number;
  clockSkewMs?: number;
  selectedAnswer: number | null;
  disabled: boolean;
  onSelectAnswer: (index: number) => void;
  onTimerExpired: () => void;
}

export function QuestionCard({
  question,
  questionIndex,
  totalQuestions,
  questionStartedAt,
  timeLimitSeconds,
  clockSkewMs = 0,
  selectedAnswer,
  disabled,
  onSelectAnswer,
  onTimerExpired,
}: QuestionCardProps) {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Question {questionIndex + 1} of {totalQuestions}
        </p>
        <h2 className="text-2xl font-bold">{question.text}</h2>
      </div>

      {/* Timer */}
      <TimerBar
        questionStartedAt={questionStartedAt}
        timeLimitSeconds={timeLimitSeconds}
        clockSkewMs={clockSkewMs}
        onExpired={onTimerExpired}
      />

      {/* Answer options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {question.answers.map((answer, i) => (
          <AnswerButton
            key={i}
            index={i}
            text={answer}
            selected={selectedAnswer === i}
            disabled={disabled}
            onSelect={onSelectAnswer}
          />
        ))}
      </div>
    </div>
  );
}
