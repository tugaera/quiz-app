// app/dashboard/profile/page.tsx — User profile, invite code generation
"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Invite } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfilePage() {
  const [email, setEmail] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchData = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      setEmail(user.email ?? null);
      setCreatedAt(user.created_at);

      const { data } = await supabase
        .from("invites")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      setInvites(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const generateInvite = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/invite/generate", { method: "POST" });
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
      } else {
        toast.success(`Invite code created: ${json.data.code}`);
        fetchData(); // Refresh list
      }
    } catch {
      toast.error("Failed to generate invite code");
    }
    setGenerating(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>Account Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p>
            <span className="text-muted-foreground">Email:</span> {email}
          </p>
          <p>
            <span className="text-muted-foreground">Member since:</span>{" "}
            {createdAt ? new Date(createdAt).toLocaleDateString() : "—"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Invite Codes</CardTitle>
          <Button onClick={generateInvite} disabled={generating} size="sm">
            {generating ? "Generating..." : "Generate New Code"}
          </Button>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No invite codes generated yet.
            </p>
          ) : (
            <div className="space-y-2">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <code className="font-mono text-sm">{invite.code}</code>
                  <Badge variant={invite.used_by ? "secondary" : "default"}>
                    {invite.used_by ? "Used" : "Available"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
