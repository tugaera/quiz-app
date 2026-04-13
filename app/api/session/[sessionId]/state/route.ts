// app/api/session/[sessionId]/state/route.ts
// Returns current session state for client sync on mount/reconnect.
// Does NOT require authentication — players may be anonymous QR scanners.
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  // Use admin client for the session/question lookup (no RLS needed for read-only state)
  const admin = getSupabaseAdminClient();

  // Fetch session
  const { data: session, error: sessionError } = await admin
    .from("quiz_sessions")
    .select("id, status, current_question_index, question_started_at, quiz_id")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json(
      { data: null, error: "Session not found" },
      { status: 404 }
    );
  }

  // Fetch questions for this quiz to get the time limit of current question
  let timeLimitSeconds: number | null = null;
  let currentQuestionId: string | null = null;

  const { data: questions } = await admin
    .from("questions")
    .select("id, time_limit_seconds, order_index")
    .eq("quiz_id", session.quiz_id)
    .order("order_index", { ascending: true });

  if (questions && questions[session.current_question_index]) {
    timeLimitSeconds = questions[session.current_question_index].time_limit_seconds;
    currentQuestionId = questions[session.current_question_index].id;
  }

  // Check if the authenticated user (if any) already answered this question
  let alreadyAnswered = false;
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && currentQuestionId) {
      const { data: player } = await admin
        .from("players")
        .select("id")
        .eq("session_id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (player) {
        const { data: existingAnswer } = await admin
          .from("answers")
          .select("id")
          .eq("player_id", player.id)
          .eq("question_id", currentQuestionId)
          .maybeSingle();

        alreadyAnswered = !!existingAnswer;
      }
    }
  } catch {
    // No authenticated user — that's fine for anonymous players
  }

  return NextResponse.json({
    data: {
      status: session.status,
      currentQuestionIndex: session.current_question_index,
      questionStartedAt: session.question_started_at,
      timeLimitSeconds,
      alreadyAnswered,
    },
    error: null,
  });
}
