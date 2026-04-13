// hooks/useSessionState.ts — Fetches and refreshes session state on mount/reconnect
"use client";

import { useEffect, useState, useCallback } from "react";
import type { SessionState } from "@/types";

export function useSessionState(sessionId: string) {
  const [state, setState] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/session/${sessionId}/state`);
      const json = await res.json();

      if (json.error) {
        setError(json.error);
      } else {
        setState(json.data);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch session state");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Fetch on mount
  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Re-fetch when tab regains focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchState();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [fetchState]);

  return { state, loading, error, refetch: fetchState };
}
