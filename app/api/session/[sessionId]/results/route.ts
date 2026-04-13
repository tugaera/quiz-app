// app/api/session/[sessionId]/results/route.ts
// Returns full results data for a completed session.
// Uses admin client to bypass RLS.
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const admin = getSupabaseAdminClient();

  // Verify session exists and is ended
  const { data: session } = await admin
    .from("quiz_sessions")
    .select("id, quiz_id, status, created_at, ended_at")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return NextResponse.json({ data: null, error: "Session not found" }, { status: 404 });
  }

  // Fetch all data in parallel
  const [questionsRes, answersRes, playersRes] = await Promise.all([
    admin
      .from("questions")
      .select("*")
      .eq("quiz_id", session.quiz_id)
      .order("order_index", { ascending: true }),
    admin
      .from("answers")
      .select("*")
      .eq("session_id", sessionId),
    admin
      .from("players")
      .select("*")
      .eq("session_id", sessionId),
  ]);

  return NextResponse.json({
    data: {
      session,
      questions: questionsRes.data ?? [],
      answers: answersRes.data ?? [],
      players: playersRes.data ?? [],
    },
    error: null,
  });
}
