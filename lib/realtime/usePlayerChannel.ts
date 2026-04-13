// lib/realtime/usePlayerChannel.ts — Player-side realtime subscriptions
"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Player } from "@/types";
import type { QuestionEventPayload } from "@/types/realtime";

type PlayerChannelCallbacks = {
  onQuizStart: (payload: QuestionEventPayload) => void;
  onNextQuestion: (payload: QuestionEventPayload) => void;
  onQuizEnd: () => void;
  onPlayerJoined?: (player: Player) => void;
};

export function usePlayerChannel(
  sessionId: string,
  callbacks: PlayerChannelCallbacks
) {
  // Use ref to avoid re-subscribing when callbacks change
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(`quiz:${sessionId}`);

    channel
      .on("broadcast", { event: "quiz_start" }, ({ payload }) => {
        cbRef.current.onQuizStart(payload);
      })
      .on("broadcast", { event: "next_question" }, ({ payload }) => {
        cbRef.current.onNextQuestion(payload);
      })
      .on("broadcast", { event: "quiz_end" }, () => {
        cbRef.current.onQuizEnd();
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "players",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          cbRef.current.onPlayerJoined?.(payload.new as Player);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);
}
