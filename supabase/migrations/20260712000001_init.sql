-- Prompt Overflow initial schema
-- Q&A structure modeled on classic Stack Overflow mechanics.

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 30),
  display_name text,
  about_me text default '',
  location text default '',
  website_url text default '',
  reputation int not null default 1,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "profiles are viewable by everyone" on public.profiles for select using (true);
create policy "users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'username', 'user' || substr(new.id::text, 1, 8))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ QUESTIONS ============
create table public.questions (
  id bigint generated always as identity primary key,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 15 and 150),
  body text not null check (char_length(body) >= 30),
  -- The prompt that produced the shared artifact. Core to Prompt Overflow.
  prompt text default null,
  artifact_url text default null, -- link to the website/app the prompt made
  score int not null default 0,
  view_count int not null default 0,
  answer_count int not null default 0,
  accepted_answer_id bigint default null,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  search_tsv tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(prompt, '')), 'B')
  ) stored
);

create index questions_search_idx on public.questions using gin (search_tsv);
create index questions_activity_idx on public.questions (last_activity_at desc);
create index questions_created_idx on public.questions (created_at desc);
create index questions_score_idx on public.questions (score desc);
create index questions_author_idx on public.questions (author_id);

alter table public.questions enable row level security;
create policy "questions viewable by everyone" on public.questions for select using (true);
create policy "authed users can ask" on public.questions for insert with check (auth.uid() = author_id);
create policy "authors can update own questions" on public.questions for update using (auth.uid() = author_id);
create policy "authors can delete own questions" on public.questions for delete using (auth.uid() = author_id);

-- ============ ANSWERS ============
create table public.answers (
  id bigint generated always as identity primary key,
  question_id bigint not null references public.questions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) >= 15),
  prompt text default null,
  score int not null default 0,
  is_accepted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index answers_question_idx on public.answers (question_id);
create index answers_author_idx on public.answers (author_id);

alter table public.answers enable row level security;
create policy "answers viewable by everyone" on public.answers for select using (true);
create policy "authed users can answer" on public.answers for insert with check (auth.uid() = author_id);
create policy "authors can update own answers" on public.answers for update using (auth.uid() = author_id);
create policy "authors can delete own answers" on public.answers for delete using (auth.uid() = author_id);

alter table public.questions
  add constraint questions_accepted_answer_fk
  foreign key (accepted_answer_id) references public.answers(id) on delete set null;

-- ============ COMMENTS ============
create table public.comments (
  id bigint generated always as identity primary key,
  post_type text not null check (post_type in ('question', 'answer')),
  post_id bigint not null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 15 and 600),
  score int not null default 0,
  created_at timestamptz not null default now()
);

create index comments_post_idx on public.comments (post_type, post_id);

alter table public.comments enable row level security;
create policy "comments viewable by everyone" on public.comments for select using (true);
create policy "authed users can comment" on public.comments for insert with check (auth.uid() = author_id);
create policy "authors can update own comments" on public.comments for update using (auth.uid() = author_id);
create policy "authors can delete own comments" on public.comments for delete using (auth.uid() = author_id);

-- ============ TAGS ============
create table public.tags (
  id bigint generated always as identity primary key,
  name text not null unique check (name ~ '^[a-z0-9][a-z0-9\-\.\+#]{0,34}$'),
  description text default '',
  question_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.tags enable row level security;
create policy "tags viewable by everyone" on public.tags for select using (true);
create policy "authed users can create tags" on public.tags for insert with check (auth.uid() is not null);

create table public.question_tags (
  question_id bigint not null references public.questions(id) on delete cascade,
  tag_id bigint not null references public.tags(id) on delete cascade,
  primary key (question_id, tag_id)
);

create index question_tags_tag_idx on public.question_tags (tag_id);

alter table public.question_tags enable row level security;
create policy "question_tags viewable by everyone" on public.question_tags for select using (true);
create policy "question authors manage tags" on public.question_tags for insert with check (
  auth.uid() = (select author_id from public.questions where id = question_id)
);
create policy "question authors remove tags" on public.question_tags for delete using (
  auth.uid() = (select author_id from public.questions where id = question_id)
);

-- Keep tag question_count in sync
create or replace function public.sync_tag_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.tags set question_count = question_count + 1 where id = new.tag_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.tags set question_count = greatest(question_count - 1, 0) where id = old.tag_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger question_tags_count
  after insert or delete on public.question_tags
  for each row execute function public.sync_tag_count();

-- ============ VOTES ============
create table public.votes (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_type text not null check (post_type in ('question', 'answer')),
  post_id bigint not null,
  vote_type smallint not null check (vote_type in (-1, 1)),
  created_at timestamptz not null default now(),
  unique (user_id, post_type, post_id)
);

create index votes_post_idx on public.votes (post_type, post_id);

alter table public.votes enable row level security;
create policy "votes viewable by everyone" on public.votes for select using (true);
create policy "authed users can vote" on public.votes for insert with check (auth.uid() = user_id);
create policy "users can change own vote" on public.votes for update using (auth.uid() = user_id);
create policy "users can remove own vote" on public.votes for delete using (auth.uid() = user_id);

-- Reputation rules (classic SO): Q up +5, Q down -2, A up +10, A down -2 (and -1 to downvoter on answers), accept +15.
create or replace function public.apply_vote_effects()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_author uuid;
  v_delta int;
  v_rep int;
  v_post_type text;
  v_post_id bigint;
begin
  if tg_op = 'DELETE' then
    v_post_type := old.post_type; v_post_id := old.post_id; v_delta := -old.vote_type;
  elsif tg_op = 'INSERT' then
    v_post_type := new.post_type; v_post_id := new.post_id; v_delta := new.vote_type;
  else -- UPDATE (switch vote direction)
    v_post_type := new.post_type; v_post_id := new.post_id; v_delta := new.vote_type - old.vote_type;
  end if;

  if v_post_type = 'question' then
    update public.questions set score = score + v_delta where id = v_post_id returning author_id into v_author;
    v_rep := case when v_delta > 0 then 5 * v_delta else 2 * v_delta end;
  else
    update public.answers set score = score + v_delta where id = v_post_id returning author_id into v_author;
    v_rep := case when v_delta > 0 then 10 * v_delta else 2 * v_delta end;
  end if;

  if v_author is not null then
    update public.profiles set reputation = greatest(reputation + v_rep, 1) where id = v_author;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger votes_effects
  after insert or update or delete on public.votes
  for each row execute function public.apply_vote_effects();

-- ============ ANSWER COUNT + ACTIVITY ============
create or replace function public.sync_answer_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.questions
      set answer_count = answer_count + 1, last_activity_at = now()
      where id = new.question_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.questions
      set answer_count = greatest(answer_count - 1, 0)
      where id = old.question_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger answers_count
  after insert or delete on public.answers
  for each row execute function public.sync_answer_count();

-- ============ ACCEPT ANSWER (rpc) ============
create or replace function public.accept_answer(p_answer_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_question_id bigint;
  v_q_author uuid;
  v_a_author uuid;
  v_prev_accepted bigint;
  v_prev_author uuid;
begin
  select a.question_id, a.author_id into v_question_id, v_a_author
    from public.answers a where a.id = p_answer_id;
  if v_question_id is null then raise exception 'answer not found'; end if;

  select q.author_id, q.accepted_answer_id into v_q_author, v_prev_accepted
    from public.questions q where q.id = v_question_id;
  if v_q_author is distinct from auth.uid() then
    raise exception 'only the question author can accept an answer';
  end if;

  -- Un-accept previous
  if v_prev_accepted is not null then
    select author_id into v_prev_author from public.answers where id = v_prev_accepted;
    update public.answers set is_accepted = false where id = v_prev_accepted;
    if v_prev_author is not null then
      update public.profiles set reputation = greatest(reputation - 15, 1) where id = v_prev_author;
    end if;
  end if;

  if v_prev_accepted = p_answer_id then
    -- Toggle off
    update public.questions set accepted_answer_id = null, last_activity_at = now() where id = v_question_id;
  else
    update public.answers set is_accepted = true where id = p_answer_id;
    update public.questions set accepted_answer_id = p_answer_id, last_activity_at = now() where id = v_question_id;
    if v_a_author is not null and v_a_author <> v_q_author then
      update public.profiles set reputation = reputation + 15 where id = v_a_author;
    end if;
  end if;
end;
$$;

-- ============ VIEW COUNT (rpc, anonymous ok) ============
create or replace function public.increment_view_count(p_question_id bigint)
returns void language sql security definer set search_path = public as $$
  update public.questions set view_count = view_count + 1 where id = p_question_id;
$$;

-- ============ CAST VOTE (rpc handles insert/toggle/switch) ============
create or replace function public.cast_vote(p_post_type text, p_post_id bigint, p_vote_type smallint)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_existing smallint;
  v_author uuid;
  v_score int;
begin
  if auth.uid() is null then raise exception 'must be logged in to vote'; end if;

  if p_post_type = 'question' then
    select author_id into v_author from public.questions where id = p_post_id;
  else
    select author_id into v_author from public.answers where id = p_post_id;
  end if;
  if v_author = auth.uid() then
    raise exception 'you cannot vote for your own post';
  end if;

  select vote_type into v_existing from public.votes
    where user_id = auth.uid() and post_type = p_post_type and post_id = p_post_id;

  if v_existing is null then
    insert into public.votes (user_id, post_type, post_id, vote_type)
      values (auth.uid(), p_post_type, p_post_id, p_vote_type);
  elsif v_existing = p_vote_type then
    delete from public.votes
      where user_id = auth.uid() and post_type = p_post_type and post_id = p_post_id;
  else
    update public.votes set vote_type = p_vote_type
      where user_id = auth.uid() and post_type = p_post_type and post_id = p_post_id;
  end if;

  if p_post_type = 'question' then
    select score into v_score from public.questions where id = p_post_id;
  else
    select score into v_score from public.answers where id = p_post_id;
  end if;
  return v_score;
end;
$$;
