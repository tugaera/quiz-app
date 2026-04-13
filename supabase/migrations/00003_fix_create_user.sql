-- =============================================================
-- Fix 00001: handle_new_user trigger (user creation was failing)
-- =============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, '')   -- guard against null email (OAuth, magic links, etc.)
  )
  ON CONFLICT (id) DO NOTHING; -- safe to re-run / retry
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public;  -- critical: ensures table resolution works in all contexts

-- Recreate the trigger cleanly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- =============================================================
-- Fix 00002: missing quiz_type column on quizzes
-- (required by the prompt, was omitted from the schema)
-- =============================================================

ALTER TABLE quizzes
  ADD COLUMN IF NOT EXISTS quiz_type TEXT NOT NULL DEFAULT 'all_questions'
    CHECK (quiz_type IN ('all_questions', 'one_by_one'));


-- =============================================================
-- Fix 00003: quiz_sessions status CHECK was missing Type 2 states
-- =============================================================

-- Postgres doesn't support ALTER CONSTRAINT directly,
-- so we drop and recreate the check constraint.
ALTER TABLE quiz_sessions
  DROP CONSTRAINT IF EXISTS quiz_sessions_status_check;

ALTER TABLE quiz_sessions
  ADD CONSTRAINT quiz_sessions_status_check
    CHECK (status IN (
      'waiting',
      'active',
      'between_questions',   -- Type 2: timer expired, host reviewing stats
      'showing_results',     -- Type 2: final question done, showing leaderboard
      'ended'
    ));


-- =============================================================
-- Fix 00004: prevent quiz_type from changing after a session exists
-- =============================================================

CREATE OR REPLACE FUNCTION prevent_quiz_type_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only block if quiz_type is actually changing
  IF NEW.quiz_type <> OLD.quiz_type THEN
    IF EXISTS (
      SELECT 1 FROM quiz_sessions WHERE quiz_id = NEW.id LIMIT 1
    ) THEN
      RAISE EXCEPTION
        'Cannot change quiz_type after a session has been created for this quiz.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS enforce_quiz_type_immutable ON quizzes;
CREATE TRIGGER enforce_quiz_type_immutable
  BEFORE UPDATE ON quizzes
  FOR EACH ROW EXECUTE FUNCTION prevent_quiz_type_change();