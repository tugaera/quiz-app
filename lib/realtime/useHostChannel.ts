// lib/realtime/useHostChannel.ts — Host-side realtime subscriptions
// Returns a channel ref that can also be used for broadcasting.
"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Player, Answer } from "@/types";
import type { QuestionEventPayload } from "@/types/realtime";

type HostChannelCallbacks = {
  onQuizStart?: (payload: QuestionEventPayload) => void;
  onNextQuestion: (payload: QuestionEventPayload) => void;
  onQuizEnd: () => void;
  onPlayerJoined?: (player: Player) => void;
  onAnswerSubmitted?: (answer: Answer) => void;
};

export function useHostChannel(
  sessionId: string,
  callbacks: HostChannelCallbacks
): React.RefObject<RealtimeChannel | null> {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(`quiz:${sessionId}`);

    channel
      .on("broadcast", { event: "quiz_start" }, ({ payload }) => {
        cbRef.current.onQuizStart?.(payload);
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
      .on("broadcast", { event: "answer_submitted" }, () => {
        cbRef.current.onAnswerSubmitted?.({} as Answer);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId]);

  return channelRef;
}
