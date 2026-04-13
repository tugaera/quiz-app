// types/database.ts — Minimal Supabase Database type definition
// In production, generate this with: npx supabase gen types typescript --local

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      invites: {
        Row: {
          id: string;
          code: string;
          created_by: string;
          used_by: string | null;
          used_at: string | null;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          created_by: string;
          used_by?: string | null;
          used_at?: string | null;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          created_by?: string;
          used_by?: string | null;
          used_at?: string | null;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      quizzes: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          description: string | null;
          quiz_type: "all_questions" | "one_by_one";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title: string;
          description?: string | null;
          quiz_type?: "all_questions" | "one_by_one";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          title?: string;
          description?: string | null;
          quiz_type?: "all_questions" | "one_by_one";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      questions: {
        Row: {
          id: string;
          quiz_id: string;
          text: string;
          answers: Json;
          correct_index: number;
          time_limit_seconds: number;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          text: string;
          answers: Json;
          correct_index: number;
          time_limit_seconds?: number;
          order_index: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          quiz_id?: string;
          text?: string;
          answers?: Json;
          correct_index?: number;
          time_limit_seconds?: number;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      quiz_sessions: {
        Row: {
          id: string;
          quiz_id: string;
          status: string;
          current_question_index: number;
          question_started_at: string | null;
          created_at: string;
          updated_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          status?: string;
          current_question_index?: number;
          question_started_at?: string | null;
          created_at?: string;
          updated_at?: string;
          ended_at?: string | null;
        };
        Update: {
          id?: string;
          quiz_id?: string;
          status?: string;
          current_question_index?: number;
          question_started_at?: string | null;
          created_at?: string;
          updated_at?: string;
          ended_at?: string | null;
        };
        Relationships: [];
      };
      players: {
        Row: {
          id: string;
          session_id: string;
          user_id: string | null;
          nickname: string;
          joined_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id?: string | null;
          nickname: string;
          joined_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string | null;
          nickname?: string;
          joined_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      answers: {
        Row: {
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
        Insert: {
          id?: string;
          player_id: string;
          session_id: string;
          question_id: string;
          selected_index?: number | null;
          is_correct?: boolean;
          response_time_ms?: number | null;
          submitted_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          player_id?: string;
          session_id?: string;
          question_id?: string;
          selected_index?: number | null;
          is_correct?: boolean;
          response_time_ms?: number | null;
          submitted_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
