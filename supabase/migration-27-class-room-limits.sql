-- Class mode limits (spec 12, TCH-5).
--
--   class_rooms.host_student_id   who opened the room, so one account can be
--                                 held to 3 open rooms and can close its own.
--                                 Null on rooms from before this migration.
--   class_rooms.last_active_at    the last create / join / start / submit. A
--                                 room is closed 12 hours after it (the app
--                                 decides that when it reads the row; nothing
--                                 runs on a timer).
--   class_participants.answers    one true/false per question, so the class
--                                 screen can show each question's percent
--                                 correct. Null on older rows.
--   class_join_attempts           wrong room codes per visitor, kept for the
--                                 10-minute limit only. ip_hash is a salted
--                                 SHA-256, never the address; rows older than
--                                 the window are deleted on the next write.
--
-- Additive. Every new column is nullable or has a default, so existing rows
-- and the code deployed before this still work. Safe to apply before the
-- code that uses it. Idempotent.

begin;

alter table public.class_rooms
  add column if not exists host_student_id uuid null references public.students (id) on delete set null;
alter table public.class_rooms
  add column if not exists last_active_at timestamptz not null default now();
create index if not exists class_rooms_host_open_idx
  on public.class_rooms (host_student_id) where status <> 'finished';

alter table public.class_participants
  add column if not exists answers jsonb null;

create table if not exists public.class_join_attempts (
  id           bigint generated always as identity primary key,
  ip_hash      text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists class_join_attempts_ip_idx
  on public.class_join_attempts (ip_hash, attempted_at);

-- Server only (the service role bypasses RLS); no policy, so no browser key can read or write it.
alter table public.class_join_attempts enable row level security;

commit;
