// app/dashboard/page.tsx — Dashboard home: list user's quizzes
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: quizzes } = await supabase
    .from("quizzes")
    .select("id, title, description, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Quizzes</h1>
        <Link href="/dashboard/quiz/new" className={buttonVariants()}>
          Create Quiz
        </Link>
      </div>

      {quizzes && quizzes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((quiz) => (
            <Link key={quiz.id} href={`/dashboard/quiz/${quiz.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle>{quiz.title}</CardTitle>
                  {quiz.description && (
                    <CardDescription>{quiz.description}</CardDescription>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(quiz.created_at).toLocaleDateString()}
                  </p>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">No quizzes yet</p>
          <Link href="/dashboard/quiz/new" className={buttonVariants()}>
            Create Your First Quiz
          </Link>
        </Card>
      )}
    </div>
  );
}
