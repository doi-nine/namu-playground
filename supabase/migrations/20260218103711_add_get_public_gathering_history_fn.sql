create or replace function get_public_gathering_history(target_user_id uuid)
returns table(gathering_id uuid, status text, joined_at timestamptz)
language plpgsql
security definer
as $$
begin
  return query
    select
      gm.gathering_id,
      gm.status,
      gm.created_at as joined_at
    from gathering_members gm
    where gm.user_id = target_user_id
    and not exists (
      select 1
      from gathering_history_settings ghs
      where ghs.user_id = target_user_id
        and ghs.gathering_id = gm.gathering_id
        and (ghs.is_private = true or ghs.is_deleted = true)
    );
end;
$$;
