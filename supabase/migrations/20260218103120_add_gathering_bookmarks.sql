create table if not exists public.gathering_bookmarks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  gathering_id uuid not null references public.gatherings(id) on delete cascade,
  created_at timestamptz default now() not null,
  unique(user_id, gathering_id)
);

alter table public.gathering_bookmarks enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'gathering_bookmarks' and policyname = '본인 즐겨찾기 조회'
  ) then
    create policy "본인 즐겨찾기 조회"
      on public.gathering_bookmarks for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'gathering_bookmarks' and policyname = '본인 즐겨찾기 추가'
  ) then
    create policy "본인 즐겨찾기 추가"
      on public.gathering_bookmarks for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'gathering_bookmarks' and policyname = '본인 즐겨찾기 삭제'
  ) then
    create policy "본인 즐겨찾기 삭제"
      on public.gathering_bookmarks for delete
      using (auth.uid() = user_id);
  end if;
end $$;
