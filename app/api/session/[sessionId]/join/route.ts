// app/api/session/[sessionId]/join/route.ts
// Allows anonymous players to join a session without authentication.
// Uses admin client to bypass RLS.
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = await request.json();
  const nickname: string = body.nickname?.trim();

  if (!nickname) {
    return NextResponse.json(
      { data: null, error: "Nickname is required" },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdminClient();

  // Verify session exists and is joinable
  const { data: session } = await admin
    .from("quiz_sessions")
    .select("id, status")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return NextResponse.json(
      { data: null, error: "Session not found" },
      { status: 404 }
    );
  }

  if (session.status === "ended") {
    return NextResponse.json(
      { data: null, error: "This quiz has already ended" },
      { status: 400 }
    );
  }

  // Insert the player (user_id is null for anonymous players)
  const { data: player, error } = await admin
    .from("players")
    .insert({
      session_id: sessionId,
      user_id: null,
      nickname,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }

  // Fetch all players for the session
  const { data: players } = await admin
    .from("players")
    .select("*")
    .eq("session_id", sessionId);

  return NextResponse.json({
    data: { player, players: players ?? [] },
    error: null,
  });
}
