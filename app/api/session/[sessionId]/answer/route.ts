// app/api/session/[sessionId]/answer/route.ts
// Allows anonymous players to submit answers without authentication.
// Uses admin client to bypass RLS.
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = await request.json();

  const {
    playerId,
    questionId,
    selectedIndex,
    isCorrect,
    responseTimeMs,
  } = body;

  if (!playerId || !questionId) {
    return NextResponse.json(
      { data: null, error: "playerId and questionId are required" },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdminClient();

  // Verify the player belongs to this session
  const { data: player } = await admin
    .from("players")
    .select("id")
    .eq("id", playerId)
    .eq("session_id", sessionId)
    .single();

  if (!player) {
    return NextResponse.json(
      { data: null, error: "Player not found in this session" },
      { status: 404 }
    );
  }

  const { data: answer, error } = await admin
    .from("answers")
    .insert({
      player_id: playerId,
      session_id: sessionId,
      question_id: questionId,
      selected_index: selectedIndex ?? null,
      is_correct: isCorrect ?? false,
      response_time_ms: responseTimeMs ?? null,
    })
    .select()
    .single();

  if (error) {
    // Duplicate answer is not a real error
    if (error.message.includes("duplicate")) {
      return NextResponse.json({ data: null, error: null });
    }
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: answer, error: null });
}
