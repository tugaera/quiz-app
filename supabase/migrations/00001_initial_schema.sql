-- =============================================================
-- Migration: 00001_initial_schema.sql
-- Real-time quiz platform database schema
--
-- HOW TO RUN: Copy-paste into Supabase Dashboard → SQL Editor → Run
-- If you get errors, run each section between the === separators
-- one at a time to find which statement fails.
-- =============================================================

-- --------------- EXTENSIONS ---------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------- HELPER: updated_at trigger ---------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============== TABLES ===============

-- 1. profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. invites
CREATE TABLE IF NOT EXISTS invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  created_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  used_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS invites_updated_at ON invites;
CREATE TRIGGER invites_updated_at
  BEFORE UPDATE ON invites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code);
CREATE INDEX IF NOT EXISTS idx_invites_created_by ON invites(created_by);

-- 3. quizzes
CREATE TABLE IF NOT EXISTS quizzes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS quizzes_updated_at ON quizzes;
CREATE TRIGGER quizzes_updated_at
  BEFORE UPDATE ON quizzes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_quizzes_owner_id ON quizzes(owner_id);

-- 4. questions
CREATE TABLE IF NOT EXISTS questions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id             UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  text                TEXT NOT NULL,
  answers             JSONB NOT NULL,  -- ["Option A", "Option B", ...]
  correct_index       SMALLINT NOT NULL,
  time_limit_seconds  SMALLINT NOT NULL DEFAULT 30
                        CHECK (time_limit_seconds BETWEEN 5 AND 60),
  order_index         SMALLINT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS questions_updated_at ON questions;
CREATE TRIGGER questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_quiz_order ON questions(quiz_id, order_index);

-- 5. quiz_sessions
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id                 UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  status                  TEXT NOT NULL DEFAULT 'waiting'
                            CHECK (status IN ('waiting', 'active', 'ended')),
  current_question_index  SMALLINT NOT NULL DEFAULT 0,
  question_started_at     TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at                TIMESTAMPTZ
);

DROP TRIGGER IF EXISTS quiz_sessions_updated_at ON quiz_sessions;
CREATE TRIGGER quiz_sessions_updated_at
  BEFORE UPDATE ON quiz_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_sessions_quiz_id ON quiz_sessions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active_timer
  ON quiz_sessions(status, question_started_at)
  WHERE status = 'active';

-- 6. players
CREATE TABLE IF NOT EXISTS players (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  nickname    TEXT NOT NULL,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS players_updated_at ON players;
CREATE TRIGGER players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_players_session_id ON players(session_id);
CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id);

-- 7. answers
CREATE TABLE IF NOT EXISTS answers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id         UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  session_id        UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  question_id       UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_index    SMALLINT,            -- NULL = no answer (timed out)
  is_correct        BOOLEAN NOT NULL DEFAULT FALSE,
  response_time_ms  INTEGER,             -- milliseconds from question_started_at
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS answers_updated_at ON answers;
CREATE TRIGGER answers_updated_at
  BEFORE UPDATE ON answers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_answers_player_id ON answers(player_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_session_id ON answers(session_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_answers_player_question
  ON answers(player_id, question_id);

-- =============== AUTO-CREATE PROFILE ON SIGNUP ===============
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate to avoid "trigger already exists" errors
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
