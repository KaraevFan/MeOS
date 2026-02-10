-- MeOS Initial Schema
-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================
-- Updated-at trigger function
-- ============================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================
-- Users table
-- ============================================
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz default now(),
  onboarding_completed boolean default false,
  sage_persona_notes text
);

alter table users enable row level security;

create policy "Users can read own data" on users
  for select using (auth.uid() = id);

create policy "Users can update own data" on users
  for update using (auth.uid() = id);

create policy "Users can insert own data" on users
  for insert with check (auth.uid() = id);

-- ============================================
-- Life maps table
-- ============================================
create table life_maps (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  is_current boolean default true,
  narrative_summary text,
  primary_compounding_engine text,
  quarterly_priorities text[],
  key_tensions text[],
  anti_goals text[],
  failure_modes text[],
  identity_statements text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table life_maps enable row level security;

create policy "Users can read own life maps" on life_maps
  for select using (auth.uid() = user_id);

create policy "Users can insert own life maps" on life_maps
  for insert with check (auth.uid() = user_id);

create policy "Users can update own life maps" on life_maps
  for update using (auth.uid() = user_id);

create trigger life_maps_updated_at
  before update on life_maps
  for each row execute function update_updated_at();

-- ============================================
-- Life map domains table
-- ============================================
create table life_map_domains (
  id uuid primary key default uuid_generate_v4(),
  life_map_id uuid not null references life_maps(id) on delete cascade,
  domain_name text not null,
  current_state text,
  whats_working text[],
  whats_not_working text[],
  desires text[],
  tensions text[],
  stated_intentions text[],
  status text check (status in ('thriving', 'stable', 'needs_attention', 'in_crisis')),
  updated_at timestamptz default now()
);

alter table life_map_domains enable row level security;

create policy "Users can read own domains" on life_map_domains
  for select using (
    exists (
      select 1 from life_maps
      where life_maps.id = life_map_domains.life_map_id
      and life_maps.user_id = auth.uid()
    )
  );

create policy "Users can insert own domains" on life_map_domains
  for insert with check (
    exists (
      select 1 from life_maps
      where life_maps.id = life_map_domains.life_map_id
      and life_maps.user_id = auth.uid()
    )
  );

create policy "Users can update own domains" on life_map_domains
  for update using (
    exists (
      select 1 from life_maps
      where life_maps.id = life_map_domains.life_map_id
      and life_maps.user_id = auth.uid()
    )
  );

create trigger life_map_domains_updated_at
  before update on life_map_domains
  for each row execute function update_updated_at();

-- ============================================
-- Sessions table
-- ============================================
create table sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  session_type text not null check (session_type in ('life_mapping', 'weekly_checkin', 'monthly_review', 'quarterly_review')),
  status text not null check (status in ('active', 'completed', 'abandoned')) default 'active',
  ai_summary text,
  sentiment text,
  key_themes text[],
  commitments_made text[],
  energy_level integer check (energy_level between 1 and 5),
  domains_explored text[],
  created_at timestamptz default now(),
  completed_at timestamptz,
  updated_at timestamptz default now()
);

alter table sessions enable row level security;

create policy "Users can read own sessions" on sessions
  for select using (auth.uid() = user_id);

create policy "Users can insert own sessions" on sessions
  for insert with check (auth.uid() = user_id);

create policy "Users can update own sessions" on sessions
  for update using (auth.uid() = user_id);

create trigger sessions_updated_at
  before update on sessions
  for each row execute function update_updated_at();

-- ============================================
-- Messages table
-- ============================================
create table messages (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  has_structured_block boolean default false,
  created_at timestamptz default now()
);

alter table messages enable row level security;

create policy "Users can read own messages" on messages
  for select using (
    exists (
      select 1 from sessions
      where sessions.id = messages.session_id
      and sessions.user_id = auth.uid()
    )
  );

create policy "Users can insert own messages" on messages
  for insert with check (
    exists (
      select 1 from sessions
      where sessions.id = messages.session_id
      and sessions.user_id = auth.uid()
    )
  );

-- ============================================
-- Patterns table
-- ============================================
create table patterns (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  pattern_type text not null check (pattern_type in ('recurring_theme', 'sentiment_trend', 'consistency', 'avoidance')),
  description text,
  first_detected timestamptz default now(),
  occurrence_count integer default 1,
  related_domain text,
  is_active boolean default true
);

alter table patterns enable row level security;

create policy "Users can read own patterns" on patterns
  for select using (auth.uid() = user_id);

create policy "Users can insert own patterns" on patterns
  for insert with check (auth.uid() = user_id);

create policy "Users can update own patterns" on patterns
  for update using (auth.uid() = user_id);

-- ============================================
-- Push subscriptions table
-- ============================================
create table push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null,
  keys jsonb not null,
  created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;

create policy "Users can read own push subscriptions" on push_subscriptions
  for select using (auth.uid() = user_id);

create policy "Users can insert own push subscriptions" on push_subscriptions
  for insert with check (auth.uid() = user_id);

create policy "Users can update own push subscriptions" on push_subscriptions
  for update using (auth.uid() = user_id);

create policy "Users can delete own push subscriptions" on push_subscriptions
  for delete using (auth.uid() = user_id);
