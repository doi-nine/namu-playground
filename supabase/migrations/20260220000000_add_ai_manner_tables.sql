-- AI 매너 태그 테이블
create table public.ai_manner_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tag_type text not null,
  tag_label text not null,
  assigned_at timestamptz not null default now(),
  unique(user_id, tag_type)
);

alter table public.ai_manner_tags enable row level security;

create policy "누구나 태그 조회 가능"
  on public.ai_manner_tags for select
  using (true);

-- INSERT/UPDATE/DELETE는 service role만 (별도 policy 없음 = anon/authenticated 차단)

-- AI 매너 경고 테이블
create table public.ai_manner_warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  warning_type text not null,
  warning_message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.ai_manner_warnings enable row level security;

create policy "본인 경고만 조회"
  on public.ai_manner_warnings for select
  using (auth.uid() = user_id);

create policy "본인 경고 읽음 처리"
  on public.ai_manner_warnings for update
  using (auth.uid() = user_id);

-- INSERT는 service role만 (별도 policy 없음)

-- AI 매너 분석 로그 테이블 (쿨다운 추적)
create table public.ai_manner_analysis_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_type text not null,
  last_analyzed_at timestamptz not null default now(),
  unique(user_id, analysis_type)
);

alter table public.ai_manner_analysis_log enable row level security;

-- service role만 접근 (별도 policy 없음)
