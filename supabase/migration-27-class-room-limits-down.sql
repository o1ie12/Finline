-- Down for migration-27. Deploy code that does not need the columns first
-- (the code from before spec 12 TCH-5, or this code: it falls back when they
-- are missing). Rooms and participants are kept; who opened a room, when it
-- was last used and the per-question marks are lost.
begin;
drop table if exists public.class_join_attempts;
alter table public.class_participants drop column if exists answers;
drop index if exists public.class_rooms_host_open_idx;
alter table public.class_rooms drop column if exists last_active_at;
alter table public.class_rooms drop column if exists host_student_id;
commit;
