// lib/env.ts — Zod-validated environment variables with server/client separation
import { z } from "zod";

// Client-safe vars (available in browser via NEXT_PUBLIC_ prefix)
const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "Supabase anon key is required"),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

// Server-only vars (never in browser bundle)
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "Supabase service role key is required"),
  INVITE_TOKEN_SECRET: z.string().min(32, "Invite token secret must be at least 32 characters"),
  SUPABASE_EDGE_FUNCTION_URL: z.string().url(),
});

export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function parseClientEnv(): ClientEnv {
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!parsed.success) {
    console.error("❌ Invalid client environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid client environment variables");
  }
  return parsed.data;
}

function parseServerEnv(): ServerEnv {
  // Only parse on the server
  if (typeof window !== "undefined") {
    return {} as ServerEnv;
  }

  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    INVITE_TOKEN_SECRET: process.env.INVITE_TOKEN_SECRET,
    SUPABASE_EDGE_FUNCTION_URL: process.env.SUPABASE_EDGE_FUNCTION_URL,
  });

  if (!parsed.success) {
    console.error("❌ Invalid server environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid server environment variables");
  }
  return parsed.data;
}

export const clientEnv = parseClientEnv();
export const serverEnv = parseServerEnv();
