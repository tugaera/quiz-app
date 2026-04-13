// app/auth/register/page.tsx — Invite-based registration
"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { registerSchema, type RegisterInput } from "@/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code") ?? "";

  const [inviteValid, setInviteValid] = useState<boolean | null>(null);
  const [inviteId, setInviteId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { inviteCode: codeFromUrl },
  });

  useEffect(() => {
    if (!codeFromUrl) {
      setInviteValid(false);
      setInviteError("No invite code provided. Add ?code=YOURCODE to the URL.");
      return;
    }
    validateCode(codeFromUrl);
  }, [codeFromUrl]);

  async function validateCode(code: string) {
    setInviteValid(null);
    setInviteError(null);
    try {
      const res = await fetch("/api/invite/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (json.error) {
        setInviteValid(false);
        setInviteError(json.error);
      } else {
        setInviteValid(true);
        setInviteId(json.data.inviteId);
        setValue("inviteCode", code);
      }
    } catch {
      setInviteValid(false);
      setInviteError("Failed to validate invite code");
    }
  }

  const onSubmit = async (data: RegisterInput) => {
    if (!inviteValid || !inviteId) {
      toast.error("Invalid invite code");
      return;
    }

    setLoading(true);
    const supabase = getSupabaseBrowserClient();

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { invite_id: inviteId },
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Mark invite as used via service-role endpoint
    await fetch("/api/invite/use", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId }),
    });

    toast.success("Account created! Redirecting...");
    router.push("/dashboard");
    router.refresh();
  };

  // Validating invite
  if (inviteValid === null && codeFromUrl) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Validating Invite...</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Register</CardTitle>
      </CardHeader>
      <CardContent>
        {inviteValid === false ? (
          <div className="text-center space-y-4">
            <p className="text-destructive">{inviteError}</p>
            <p className="text-sm text-muted-foreground">
              Registration requires a valid invite code from an existing user.
            </p>
            <Link href="/auth/login" className={buttonVariants({ variant: "outline" })}>
              Go to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inviteCode">Invite Code</Label>
              <Input
                id="inviteCode"
                value={codeFromUrl}
                disabled
                {...register("inviteCode")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min 8 characters"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>
        )}

        <p className="text-sm text-muted-foreground text-center mt-4">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="underline hover:text-foreground"
          >
            Sign In
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <Suspense
        fallback={
          <Card className="w-full max-w-md">
            <CardContent className="space-y-4 pt-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        }
      >
        <RegisterForm />
      </Suspense>
    </main>
  );
}
