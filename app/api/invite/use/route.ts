// app/api/invite/use/route.ts
// Marks an invite as used after successful registration
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { inviteId } = await request.json();

  if (!inviteId) {
    return NextResponse.json(
      { data: null, error: "inviteId is required" },
      { status: 400 }
    );
  }

  // Get the newly registered user
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Use admin client to bypass RLS for marking invite used
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("invites")
    .update({
      used_by: user?.id ?? null,
      used_at: new Date().toISOString(),
    })
    .eq("id", inviteId)
    .is("used_by", null); // Only update if not already used

  if (error) {
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: { success: true }, error: null });
}
