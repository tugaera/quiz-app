// app/page.tsx — Landing page
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="space-y-4">
        <h1 className="text-5xl font-bold tracking-tight">QuizLive</h1>
        <p className="text-xl text-muted-foreground max-w-md">
          Host real-time quizzes with friends. Server-synced timers,
          instant results, and live leaderboards.
        </p>
      </div>
      <div className="flex gap-4">
        <Link href="/auth/login" className={buttonVariants({ size: "lg" })}>
          Sign In
        </Link>
        <Link href="/auth/register" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Register
        </Link>
      </div>
    </main>
  );
}
