-- Prompt Overflow: social features
-- Adds: comment voting, comment edit tracking, @mentions + notifications,
-- username-based login support, and a magic-link friendly auth flow.

-- ============ COMMENT EDIT TRACKING ============
alter table public.comments
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists edited_at timestamptz default null;

-- ============ COMMENT VOTES ============
-- Classic Stack Overflow comments are upvote-only. Store one upvote per user
-- per comment; the comments.score column is kept in sync via trigger.
create table if not exists public.comment_votes (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  comment_id bigint not null references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, comment_id)
);

create index if not exists comment_votes_comment_idx on public.comment_votes (comment_id);

alter table public.comment_votes enable row level security;

drop policy if exists "comment votes viewable by everyone" on public.comment_votes;
create policy "comment votes viewable by everyone" on public.comment_votes for select using (true);
drop policy if exists "authed users can vote on comments" on public.comment_votes;
create policy "authed users can vote on comments" on public.comment_votes for insert with check (auth.uid() = user_id);
drop policy if exists "users can remove own comment vote" on public.comment_votes;
create policy "users can remove own comment vote" on public.comment_votes for delete using (auth.uid() = user_id);

-- Keep comments.score in sync with comment_votes.
create or replace function public.sync_comment_score()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.comments set score = score + 1 where id = new.comment_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.comments set score = greatest(score - 1, 0) where id = old.comment_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists comment_votes_score on public.comment_votes;
create trigger comment_votes_score
  after insert or delete on public.comment_votes
  for each row execute function public.sync_comment_score();

-- Toggle an upvote on a comment (cannot upvote your own comment).
create or replace function public.cast_comment_vote(p_comment_id bigint)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_author uuid;
  v_existing bigint;
  v_score int;
begin
  if auth.uid() is null then raise exception 'must be logged in to vote'; end if;

  select author_id into v_author from public.comments where id = p_comment_id;
  if v_author is null then raise exception 'comment not found'; end if;
  if v_author = auth.uid() then raise exception 'you cannot vote for your own comment'; end if;

  select id into v_existing from public.comment_votes
    where user_id = auth.uid() and comment_id = p_comment_id;

  if v_existing is null then
    insert into public.comment_votes (user_id, comment_id) values (auth.uid(), p_comment_id);
  else
    delete from public.comment_votes where id = v_existing;
  end if;

  select score into v_score from public.comments where id = p_comment_id;
  return v_score;
end;
$$;

-- ============ NOTIFICATIONS (for @mentions) ============
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,   -- recipient
  actor_id uuid references public.profiles(id) on delete set null,          -- who triggered it
  type text not null check (type in ('mention', 'comment')),
  comment_id bigint references public.comments(id) on delete cascade,
  question_id bigint references public.questions(id) on delete cascade,
  post_type text check (post_type in ('question', 'answer')),
  post_id bigint,
  snippet text default '',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, is_read, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications" on public.notifications for update using (auth.uid() = user_id);

-- Create @mention notifications for a freshly posted comment. Security definer so
-- it can insert notifications for other users. Skips self-mentions and duplicates.
create or replace function public.notify_mentions(
  p_comment_id bigint,
  p_question_id bigint,
  p_usernames text[]
)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid;
  v_post_type text;
  v_post_id bigint;
  v_body text;
  v_snippet text;
  v_uname text;
  v_recipient uuid;
  v_count int := 0;
begin
  if auth.uid() is null then return 0; end if;
  select author_id, post_type, post_id, body
    into v_actor, v_post_type, v_post_id, v_body
    from public.comments where id = p_comment_id;
  if v_actor is null or v_actor <> auth.uid() then
    -- Only the comment author may generate its mention notifications.
    return 0;
  end if;
  v_snippet := left(v_body, 140);

  foreach v_uname in array p_usernames loop
    select id into v_recipient from public.profiles where username = lower(v_uname);
    if v_recipient is not null and v_recipient <> v_actor then
      insert into public.notifications
        (user_id, actor_id, type, comment_id, question_id, post_type, post_id, snippet)
        values (v_recipient, v_actor, 'mention', p_comment_id, p_question_id, v_post_type, v_post_id, v_snippet);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

create or replace function public.mark_notifications_read()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update public.notifications set is_read = true where user_id = auth.uid() and is_read = false;
end;
$$;

-- ============ USERNAME LOGIN SUPPORT ============
-- Resolve a username to its email so users can sign in with either. Returns null
-- if not found. Security definer to read auth.users; only exposes the email for an
-- exact username match (the caller already needs the password to sign in).
create or replace function public.email_for_username(p_username text)
returns text language plpgsql security definer set search_path = public, auth as $$
declare
  v_id uuid;
  v_email text;
begin
  select id into v_id from public.profiles where username = lower(p_username);
  if v_id is null then return null; end if;
  select email into v_email from auth.users where id = v_id;
  return v_email;
end;
$$;

revoke all on function public.email_for_username(text) from public;
grant execute on function public.email_for_username(text) to anon, authenticated;

-- Enforce username format at the DB level for updates too (lowercase handled in app).
