// app/dashboard/layout.tsx — Dashboard layout with nav and auth guard
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b bg-background">
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-bold text-lg">
              QuizLive
            </Link>
            <Link
              href="/dashboard/profile"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Profile
            </Link>
            <Link
              href="/dashboard/quiz/new"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              New Quiz
            </Link>
          </div>
          <form action="/api/auth/signout" method="post">
            <Button variant="ghost" size="sm" type="submit">
              Sign Out
            </Button>
          </form>
        </nav>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {children}
      </main>
    </div>
  );
}
