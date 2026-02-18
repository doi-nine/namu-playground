create table public.gathering_history_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  gathering_id uuid not null references public.gatherings(id) on delete cascade,
  is_private boolean default false not null,
  is_deleted boolean default false not null,
  primary key (user_id, gathering_id)
);

alter table public.gathering_history_settings enable row level security;

create policy "본인 이력 설정 조회"
  on public.gathering_history_settings for select
  using (auth.uid() = user_id);

create policy "본인 이력 설정 추가/수정"
  on public.gathering_history_settings for insert
  with check (auth.uid() = user_id);

create policy "본인 이력 설정 업데이트"
  on public.gathering_history_settings for update
  using (auth.uid() = user_id);

create policy "본인 이력 설정 삭제"
  on public.gathering_history_settings for delete
  using (auth.uid() = user_id);
