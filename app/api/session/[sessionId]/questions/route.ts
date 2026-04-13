// app/api/session/[sessionId]/questions/route.ts
// Returns questions for a session. Strips correct_index from the response
// but includes it in a separate array for client-side scoring.
// Uses admin client to bypass RLS (anonymous players need access).
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const admin = getSupabaseAdminClient();

  // Get the quiz_id from the session
  const { data: session } = await admin
    .from("quiz_sessions")
    .select("quiz_id, status")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return NextResponse.json(
      { data: null, error: "Session not found" },
      { status: 404 }
    );
  }

  // Only serve questions if the session is active or ended
  if (session.status === "waiting") {
    return NextResponse.json(
      { data: null, error: "Quiz has not started yet" },
      { status: 400 }
    );
  }

  const { data: questions, error } = await admin
    .from("questions")
    .select("id, quiz_id, text, answers, correct_index, time_limit_seconds, order_index, created_at, updated_at")
    .eq("quiz_id", session.quiz_id)
    .order("order_index", { ascending: true });

  if (error || !questions) {
    return NextResponse.json(
      { data: null, error: "Failed to fetch questions" },
      { status: 500 }
    );
  }

  // Separate: questions without correct_index, and correct indexes for scoring
  const playerQuestions = questions.map(({ correct_index: _ci, ...rest }) => rest);
  const correctIndexes = questions.map((q) => ({
    id: q.id,
    correctIndex: q.correct_index,
  }));

  return NextResponse.json({
    data: { questions: playerQuestions, correctIndexes },
    error: null,
  });
}
