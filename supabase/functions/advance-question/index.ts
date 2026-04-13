// supabase/functions/advance-question/index.ts
// Edge Function: checks active sessions for expired questions and auto-advances.
// Triggered by pg_cron or external scheduler every ~1-2 seconds.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Step 1: Find all active sessions
  const { data: activeSessions, error } = await supabase
    .from("quiz_sessions")
    .select("id, quiz_id, current_question_index, question_started_at")
    .eq("status", "active")
    .not("question_started_at", "is", null);

  if (error || !activeSessions?.length) {
    return new Response(
      JSON.stringify({ processed: 0, error: error?.message }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const now = new Date();
  let processed = 0;

  for (const session of activeSessions) {
    // Step 2: Fetch questions for this quiz, sorted by order_index
    const { data: questions } = await supabase
      .from("questions")
      .select("id, order_index, time_limit_seconds")
      .eq("quiz_id", session.quiz_id)
      .order("order_index", { ascending: true });

    if (!questions?.length) continue;

    const currentQ = questions[session.current_question_index];
    if (!currentQ) continue;

    // Check if current question has expired
    const startedAt = new Date(session.question_started_at!);
    const expiresAt = new Date(
      startedAt.getTime() + currentQ.time_limit_seconds * 1000
    );

    if (now < expiresAt) continue; // Not expired yet

    const nextIndex = session.current_question_index + 1;
    const hasMore = nextIndex < questions.length;

    if (hasMore) {
      // Step 3a: Advance to next question
      const nextQuestion = questions[nextIndex];
      const newStartedAt = now.toISOString();

      await supabase
        .from("quiz_sessions")
        .update({
          current_question_index: nextIndex,
          question_started_at: newStartedAt,
        })
        .eq("id", session.id);

      // Broadcast next_question event
      const channel = supabase.channel(`quiz:${session.id}`);
      await channel.send({
        type: "broadcast",
        event: "next_question",
        payload: {
          questionIndex: nextIndex,
          questionStartedAt: newStartedAt,
          timeLimitSeconds: nextQuestion.time_limit_seconds,
        },
      });
      supabase.removeChannel(channel);
    } else {
      // Step 3b: End the quiz
      await supabase
        .from("quiz_sessions")
        .update({
          status: "ended",
          ended_at: now.toISOString(),
          question_started_at: null,
        })
        .eq("id", session.id);

      // Broadcast quiz_end event
      const channel = supabase.channel(`quiz:${session.id}`);
      await channel.send({
        type: "broadcast",
        event: "quiz_end",
        payload: {},
      });
      supabase.removeChannel(channel);
    }

    processed++;
  }

  return new Response(
    JSON.stringify({ processed }),
    { headers: { "Content-Type": "application/json" } }
  );
});
