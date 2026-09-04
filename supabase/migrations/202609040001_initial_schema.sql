-- Jura Agent MVP schema. Intended for a dedicated Supabase project with public sign-up disabled.
create extension if not exists pgcrypto;

create type public.learning_mode as enum ('explanation', 'socratic', 'correction');
create type public.message_role as enum ('user', 'assistant', 'system');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  mode public.learning_mode not null,
  subject text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role public.message_role not null,
  content jsonb not null default '{}'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  storage_path text not null unique,
  page_count integer check (page_count is null or page_count between 1 and 150),
  extraction_status text not null check (extraction_status in ('pending', 'completed', 'failed')),
  extracted_text text not null default '',
  search_vector tsvector generated always as (to_tsvector('german', coalesce(extracted_text, ''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  page_number integer not null check (page_number between 1 and 150),
  extracted_text text not null default '',
  search_vector tsvector generated always as (to_tsvector('german', coalesce(extracted_text, ''))) stored,
  created_at timestamptz not null default now(),
  unique (document_id, page_number)
);

create table public.correction_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  central_score numeric(4,1) not null check (central_score between 0 and 18),
  min_score numeric(4,1) not null check (min_score between 0 and 18),
  max_score numeric(4,1) not null check (max_score between 0 and 18),
  confidence text not null check (confidence in ('niedrig', 'mittel', 'hoch')),
  report jsonb not null,
  created_at timestamptz not null default now(),
  check (min_score <= central_score and central_score <= max_score)
);

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  provider text not null,
  model text not null,
  mode text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cost_eur numeric(12,6) not null default 0 check (cost_eur >= 0),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  response_id text,
  source_count integer not null default 0 check (source_count >= 0),
  created_at timestamptz not null default now()
);

create table public.legal_source_cache (
  cache_key text primary key,
  provider text not null,
  query jsonb not null,
  response jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > fetched_at)
);

create index conversations_user_updated_idx on public.conversations(user_id, updated_at desc);
create index messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index documents_user_created_idx on public.documents(user_id, created_at desc);
create index documents_search_idx on public.documents using gin(search_vector);
create index document_pages_search_idx on public.document_pages using gin(search_vector);
create index ai_runs_created_idx on public.ai_runs(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger conversations_set_updated_at before update on public.conversations
for each row execute function public.set_updated_at();
create trigger documents_set_updated_at before update on public.documents
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Dedicated-project shared budget: both authenticated users see only the aggregate number,
-- never the other user's individual runs.
create or replace function public.get_shared_monthly_ai_spend()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(cost_eur), 0)
  from public.ai_runs
  where created_at >= date_trunc('month', timezone('UTC', now())) at time zone 'UTC';
$$;
revoke all on function public.get_shared_monthly_ai_spend() from public;
grant execute on function public.get_shared_monthly_ai_spend() to authenticated;

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.documents enable row level security;
alter table public.document_pages enable row level security;
alter table public.correction_reports enable row level security;
alter table public.ai_runs enable row level security;
alter table public.legal_source_cache enable row level security;

create policy "profiles_owner_all" on public.profiles
for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "conversations_owner_all" on public.conversations
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "messages_owner_all" on public.messages
for all to authenticated using (user_id = auth.uid()) with check (
  user_id = auth.uid() and exists (
    select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()
  )
);
create policy "documents_owner_all" on public.documents
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "document_pages_owner_all" on public.document_pages
for all to authenticated using (user_id = auth.uid()) with check (
  user_id = auth.uid() and exists (
    select 1 from public.documents d where d.id = document_id and d.user_id = auth.uid()
  )
);
create policy "correction_reports_owner_all" on public.correction_reports
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_runs_owner_select" on public.ai_runs
for select to authenticated using (user_id = auth.uid());
create policy "ai_runs_owner_insert" on public.ai_runs
for insert to authenticated with check (user_id = auth.uid());
create policy "legal_cache_authenticated_read" on public.legal_source_cache
for select to authenticated using (expires_at > now());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  26214400,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf','text/plain','text/markdown']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "document_objects_owner_select" on storage.objects
for select to authenticated using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "document_objects_owner_insert" on storage.objects
for insert to authenticated with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "document_objects_owner_delete" on storage.objects
for delete to authenticated using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
