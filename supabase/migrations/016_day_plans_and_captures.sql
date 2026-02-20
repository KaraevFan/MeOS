-- Day Plan Artifact tables: day_plans (interactive operational data) + captures (queryable capture rows)
-- These supplement the existing markdown file system (day-plans/*.md, captures/*.md).
-- Postgres handles interactive state (checkboxes, priorities, threads); markdown handles content for Sage.

-- day_plans: one row per user per day, stores morning session output + interactive state
CREATE TABLE day_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  intention TEXT,
  energy_level TEXT CHECK (energy_level IN ('fired_up', 'focused', 'neutral', 'low', 'stressed')),
  morning_session_id UUID REFERENCES sessions(id),
  morning_completed_at TIMESTAMPTZ,
  evening_session_id UUID REFERENCES sessions(id),
  evening_completed_at TIMESTAMPTZ,
  evening_reflection JSONB,
  open_threads JSONB DEFAULT '[]'::jsonb,
  priorities JSONB DEFAULT '[]'::jsonb,
  briefing_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

-- captures: promoted from markdown files to queryable rows for grouped display, checkboxes, type filtering
CREATE TABLE captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_plan_id UUID REFERENCES day_plans(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  classification TEXT CHECK (classification IN ('thought', 'task', 'idea', 'tension')),
  auto_tags TEXT[] DEFAULT '{}',
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'morning_session', 'conversation')),
  explored BOOLEAN DEFAULT false,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: deny-by-default — users can only access their own rows
ALTER TABLE day_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE captures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own day plans"
  ON day_plans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own captures"
  ON captures FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_day_plans_user_date ON day_plans(user_id, date);
CREATE INDEX idx_captures_user_day_plan ON captures(user_id, day_plan_id);
CREATE INDEX idx_captures_day_plan_classification ON captures(day_plan_id, classification);
CREATE INDEX idx_captures_user_created ON captures(user_id, created_at DESC);
