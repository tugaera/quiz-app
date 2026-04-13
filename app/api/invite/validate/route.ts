// app/api/invite/validate/route.ts
// Validates an invite code — uses service-role client since callers may be unauthenticated
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const code = body?.code;

  if (!code || typeof code !== "string") {
    return NextResponse.json(
      { data: null, error: "Invite code is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdminClient();

  const { data: invite, error } = await supabase
    .from("invites")
    .select("id, code, used_by, expires_at")
    .eq("code", code.toUpperCase())
    .single();

  if (error || !invite) {
    return NextResponse.json(
      { data: null, error: "Invite code not found" },
      { status: 404 }
    );
  }

  if (invite.used_by) {
    return NextResponse.json(
      { data: null, error: "Invite code already used" },
      { status: 410 }
    );
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json(
      { data: null, error: "Invite code expired" },
      { status: 410 }
    );
  }

  return NextResponse.json({
    data: { valid: true, inviteId: invite.id },
    error: null,
  });
}
