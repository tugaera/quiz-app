// app/dashboard/quiz/[quizId]/page.tsx — Quiz detail: info, sessions, QR code
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Quiz, QuizSession } from "@/types";
import { QRModal } from "@/components/quiz/QRModal";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function QuizDetailPage() {
  const params = useParams<{ quizId: string }>();
  const router = useRouter();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingSession, setCreatingSession] = useState(false);

  const fetchData = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();

    const { data: quizData } = await supabase
      .from("quizzes")
      .select("*")
      .eq("id", params.quizId)
      .single();

    if (!quizData) {
      toast.error("Quiz not found");
      router.push("/dashboard");
      return;
    }
    setQuiz(quizData as Quiz);

    const { count } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("quiz_id", params.quizId);
    setQuestionCount(count ?? 0);

    const { data: sessionsData } = await supabase
      .from("quiz_sessions")
      .select("*")
      .eq("quiz_id", params.quizId)
      .order("created_at", { ascending: false });
    setSessions((sessionsData ?? []) as QuizSession[]);

    setLoading(false);
  }, [params.quizId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createSession = async () => {
    setCreatingSession(true);
    const supabase = getSupabaseBrowserClient();

    const { data: session, error } = await supabase
      .from("quiz_sessions")
      .insert({ quiz_id: params.quizId })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      setCreatingSession(false);
      return;
    }

    toast.success("Session created!");
    setSessions((prev) => [session as QuizSession, ...prev]);
    setCreatingSession(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!quiz) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{quiz.title}</h1>
          {quiz.description && (
            <p className="text-muted-foreground mt-1">{quiz.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/quiz/${quiz.id}/edit`} className={buttonVariants({ variant: "outline" })}>
            Edit Questions
          </Link>
          <Button onClick={createSession} disabled={creatingSession || questionCount === 0}>
            {creatingSession ? "Creating..." : "Start New Session"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quiz Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p>
            <span className="text-muted-foreground">Questions:</span>{" "}
            {questionCount}
          </p>
          <p>
            <span className="text-muted-foreground">Type:</span>{" "}
            {quiz.quiz_type === "one_by_one" ? "One by One (timed)" : "All Questions (self-paced)"}
          </p>
          <p>
            <span className="text-muted-foreground">Created:</span>{" "}
            {new Date(quiz.created_at).toLocaleDateString()}
          </p>
          {questionCount === 0 && (
            <p className="text-sm text-destructive">
              Add questions before starting a session.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No sessions yet.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        session.status === "active"
                          ? "default"
                          : session.status === "ended"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {session.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(session.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {session.status === "waiting" && (
                      <QRModal sessionId={session.id} />
                    )}
                    <Link
                      href={
                        session.status === "ended"
                          ? `/dashboard/quiz/${quiz.id}/session/${session.id}/results`
                          : `/dashboard/quiz/${quiz.id}/session/${session.id}`
                      }
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      {session.status === "ended" ? "Results" : "Dashboard"}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
