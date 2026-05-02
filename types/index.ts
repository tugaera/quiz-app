// types/index.ts — Database row types, SessionState, and Zod form schemas
import { z } from "zod";

// ─── Database Row Types ────────────────────────────────────

export type Profile = {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
};

export type Invite = {
  id: string;
  code: string;
  created_by: string;
  used_by: string | null;
  used_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type Quiz = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  quiz_type: "all_questions" | "one_by_one";
  created_at: string;
  updated_at: string;
};

export type Question = {
  id: string;
  quiz_id: string;
  text: string;
  answers: string[]; // 2-4 answer option strings
  correct_index: number;
  time_limit_seconds: number;
  order_index: number;
  created_at: string;
  updated_at: string;
};

/** Question without correct_index — safe to send to players during gameplay */
export type PlayerQuestion = Omit<Question, "correct_index">;

export type QuizSession = {
  id: string;
  quiz_id: string;
  status: "waiting" | "active" | "ended";
  current_question_index: number;
  question_started_at: string | null;
  created_at: string;
  updated_at: string;
  ended_at: string | null;
};

export type Player = {
  id: string;
  session_id: string;
  user_id: string | null;
  nickname: string;
  joined_at: string;
  created_at: string;
  updated_at: string;
};

export type Answer = {
  id: string;
  player_id: string;
  session_id: string;
  question_id: string;
  selected_index: number | null;
  is_correct: boolean;
  response_time_ms: number | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
};

// ─── API Response Types ────────────────────────────────────

export type SessionState = {
  status: "waiting" | "active" | "ended";
  currentQuestionIndex: number;
  questionStartedAt: string | null;
  timeLimitSeconds: number | null;
  alreadyAnswered: boolean;
  /** Server epoch ms when this payload was generated — sync device skew for countdowns */
  serverNow?: number;
};

/** Standard API response wrapper */
export type ApiResponse<T> =
  | { data: T; error: null }
  | { data: null; error: string };

// ─── Zod Form Schemas ─────────────────────────────────────

export const createQuizSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().max(1000, "Description too long").optional(),
  quizType: z.enum(["all_questions", "one_by_one"]),
});
export type CreateQuizInput = z.infer<typeof createQuizSchema>;

export const questionSchema = z.object({
  id: z.string().optional(), // present when editing existing question
  text: z.string().min(1, "Question text is required").max(500),
  answers: z
    .array(z.string().min(1, "Answer cannot be empty"))
    .min(2, "At least 2 answers required")
    .max(4, "Maximum 4 answers"),
  correctIndex: z.number().min(0),
  timeLimitSeconds: z
    .number()
    .min(5, "Minimum 5 seconds")
    .max(60, "Maximum 60 seconds"),
});
export type QuestionInput = z.infer<typeof questionSchema>;

export const questionsFormSchema = z.object({
  questions: z.array(questionSchema).min(1, "At least one question is required"),
});
export type QuestionsFormInput = z.infer<typeof questionsFormSchema>;

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  inviteCode: z.string().min(1, "Invite code is required"),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const nicknameSchema = z.object({
  nickname: z.string().min(1, "Nickname is required").max(30, "Nickname too long"),
});
export type NicknameInput = z.infer<typeof nicknameSchema>;
