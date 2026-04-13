-- =============================================================
-- Migration: 00002_rls_and_realtime.sql
-- RLS policies and Realtime publication
--
-- Run this AFTER 00001_initial_schema.sql succeeds.
-- Safe to re-run: uses DROP POLICY IF EXISTS before each CREATE.
-- =============================================================

-- =============== ENABLE ROW LEVEL SECURITY ===============
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

-- =============== PROFILES ===============
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- =============== INVITES ===============
DROP POLICY IF EXISTS "Users can read own invites" ON invites;
CREATE POLICY "Users can read own invites"
  ON invites FOR SELECT
  USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can create invites" ON invites;
CREATE POLICY "Users can create invites"
  ON invites FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- =============== QUIZZES ===============
DROP POLICY IF EXISTS "Quiz owners can do everything" ON quizzes;
CREATE POLICY "Quiz owners can do everything"
  ON quizzes FOR ALL
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Players can read quiz for their session" ON quizzes;
CREATE POLICY "Players can read quiz for their session"
  ON quizzes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quiz_sessions qs
      JOIN players p ON p.session_id = qs.id
      WHERE qs.quiz_id = quizzes.id
        AND p.user_id = auth.uid()
    )
  );

-- =============== QUESTIONS ===============
DROP POLICY IF EXISTS "Quiz owners can manage questions" ON questions;
CREATE POLICY "Quiz owners can manage questions"
  ON questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = questions.quiz_id
        AND quizzes.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Players can read questions for active sessions" ON questions;
CREATE POLICY "Players can read questions for active sessions"
  ON questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quiz_sessions qs
      JOIN players p ON p.session_id = qs.id
      WHERE qs.quiz_id = questions.quiz_id
        AND p.user_id = auth.uid()
        AND qs.status IN ('active', 'ended')
    )
  );

-- =============== QUIZ SESSIONS ===============
DROP POLICY IF EXISTS "Quiz owners can manage sessions" ON quiz_sessions;
CREATE POLICY "Quiz owners can manage sessions"
  ON quiz_sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = quiz_sessions.quiz_id
        AND quizzes.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Players can read their session" ON quiz_sessions;
CREATE POLICY "Players can read their session"
  ON quiz_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.session_id = quiz_sessions.id
        AND players.user_id = auth.uid()
    )
  );

-- =============== PLAYERS ===============
DROP POLICY IF EXISTS "Authenticated users can join sessions" ON players;
CREATE POLICY "Authenticated users can join sessions"
  ON players FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Session participants can read player list" ON players;
CREATE POLICY "Session participants can read player list"
  ON players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM players AS p2
      WHERE p2.session_id = players.session_id
        AND p2.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM quiz_sessions qs
      JOIN quizzes q ON q.id = qs.quiz_id
      WHERE qs.id = players.session_id
        AND q.owner_id = auth.uid()
    )
  );

-- =============== ANSWERS ===============
DROP POLICY IF EXISTS "Players can submit their own answers" ON answers;
CREATE POLICY "Players can submit their own answers"
  ON answers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = answers.player_id
        AND players.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Players can read own answers" ON answers;
CREATE POLICY "Players can read own answers"
  ON answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = answers.player_id
        AND players.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Quiz owners can read session answers" ON answers;
CREATE POLICY "Quiz owners can read session answers"
  ON answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quiz_sessions qs
      JOIN quizzes q ON q.id = qs.quiz_id
      WHERE qs.id = answers.session_id
        AND q.owner_id = auth.uid()
    )
  );

-- =============== ENABLE REALTIME ===============
-- These may fail if already added — that is OK, just ignore the error.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE quiz_sessions;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- already added, ignore
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE players;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE answers;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;
