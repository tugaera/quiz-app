// app/api/invite/generate/route.ts
// Generates a new single-use invite code for the authenticated user
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Generate 8-char uppercase alphanumeric code
  const code = crypto.randomUUID().slice(0, 8).toUpperCase();

  const { data: invite, error } = await supabase
    .from("invites")
    .insert({ code, created_by: user.id })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: { code: invite.code, id: invite.id },
    error: null,
  });
}
