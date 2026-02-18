alter table public.schedule_members
  add column if not exists attendance_status text not null default 'pending';
