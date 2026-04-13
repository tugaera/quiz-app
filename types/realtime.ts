// types/realtime.ts — Realtime broadcast event types

export type QuizStartEvent = {
  event: "quiz_start";
  payload: {
    questionIndex: 0;
    questionStartedAt: string; // ISO 8601
    timeLimitSeconds: number;
  };
};

export type NextQuestionEvent = {
  event: "next_question";
  payload: {
    questionIndex: number;
    questionStartedAt: string; // ISO 8601
    timeLimitSeconds: number;
  };
};

export type QuizEndEvent = {
  event: "quiz_end";
  payload: Record<string, never>;
};

export type QuizBroadcastEvent =
  | QuizStartEvent
  | NextQuestionEvent
  | QuizEndEvent;

/** Payload shape shared by quiz_start and next_question */
export type QuestionEventPayload = {
  questionIndex: number;
  questionStartedAt: string;
  timeLimitSeconds: number;
};
