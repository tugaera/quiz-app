-- =============================================================
-- Fix: infinite recursion in quizzes RLS policies
-- =============================================================

-- ── Helper functions (SECURITY DEFINER = bypass RLS) ─────────

-- Checks if the current user is the owner of a quiz session
-- Used to avoid quizzes→quiz_sessions→players→quizzes loop
CREATE OR REPLACE FUNCTION is_session_owner(p_session_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM quiz_sessions qs
    JOIN quizzes q ON q.id = qs.quiz_id
    WHERE qs.id = p_session_id
      AND q.owner_id = auth.uid()
  );
$$ LANGUAGE sql
   SECURITY DEFINER
   STABLE
   SET search_path = public;

-- Checks if the current user is a player in a given session
-- Used to avoid players→quiz_sessions→quizzes loop
CREATE OR REPLACE FUNCTION is_session_player(p_session_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM players
    WHERE session_id = p_session_id
      AND user_id = auth.uid()
  );
$$ LANGUAGE sql
   SECURITY DEFINER
   STABLE
   SET search_path = public;

-- Checks if the current user is a player in any session of a given quiz
-- Used in the quizzes policy to avoid re-entering quizzes RLS
CREATE OR REPLACE FUNCTION is_quiz_player(p_quiz_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM quiz_sessions qs
    JOIN players p ON p.session_id = qs.id
    WHERE qs.quiz_id = p_quiz_id
      AND p.user_id = auth.uid()
  );
$$ LANGUAGE sql
   SECURITY DEFINER
   STABLE
   SET search_path = public;


-- ── Recreate the three policies that formed the cycle ─────────

-- 1. quizzes: players reading quiz info for their session
DROP POLICY IF EXISTS "Players can read quiz for their session" ON quizzes;
CREATE POLICY "Players can read quiz for their session"
  ON quizzes FOR SELECT
  USING ( is_quiz_player(id) );   -- no longer touches quizzes RLS directly


-- 2. quiz_sessions: players reading their own session
DROP POLICY IF EXISTS "Players can read their session" ON quiz_sessions;
CREATE POLICY "Players can read their session"
  ON quiz_sessions FOR SELECT
  USING ( is_session_player(id) );  -- no longer touches quiz_sessions RLS


-- 3. players: session participants + quiz owner reading player list
DROP POLICY IF EXISTS "Session participants can read player list" ON players;
CREATE POLICY "Session participants can read player list"
  ON players FOR SELECT
  USING (
    is_session_player(session_id)   -- am I in this session?
    OR
    is_session_owner(session_id)    -- or do I own the quiz for this session?
  );