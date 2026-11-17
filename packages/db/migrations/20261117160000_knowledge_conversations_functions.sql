-- Migration 2 : connaissances (pgvector), conversations, messages, fonctions (Neon).
-- Additive : aucune table existante n'est modifiée. RLS, autorisations et fonctions dans la même
-- migration (project.md §7 et §9). Après elle, tout le schéma du §7 existe.

-- Sur Neon, pgvector s'installe avec `create extension vector` (rôle propriétaire, sans superutilisateur).
-- Schéma `public` explicite : les fonctions ci-dessous ont `search_path = ''` et qualifient `public.vector`.
create extension if not exists vector with schema public;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.knowledge_sources (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 200),
  type        text not null check (type in ('text', 'pdf', 'md', 'txt')),
  storage_key text,
  status      text not null default 'uploading'
                check (status in ('uploading', 'processing', 'ready', 'failed')),
  created_at  timestamptz not null default now(),
  -- Cible de la clé étrangère composite de knowledge_chunks (un segment ne peut pas changer de projet).
  unique (id, project_id)
);

create index knowledge_sources_project_id_idx on public.knowledge_sources (project_id);

create table public.knowledge_chunks (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  source_id  uuid not null,
  content    text not null,
  embedding  public.vector(1536) not null,
  -- Supprimés avec leur source ; le projet du segment est forcément celui de sa source.
  foreign key (source_id, project_id)
    references public.knowledge_sources (id, project_id) on delete cascade
);

create index knowledge_chunks_source_id_idx on public.knowledge_chunks (source_id);
create index knowledge_chunks_project_id_idx on public.knowledge_chunks (project_id);
create index knowledge_chunks_embedding_idx
  on public.knowledge_chunks using hnsw (embedding public.vector_cosine_ops);

create table public.conversations (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  visitor_id text not null check (char_length(visitor_id) between 1 and 200),
  created_at timestamptz not null default now()
);

create index conversations_project_id_idx on public.conversations (project_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role            text not null check (role in ('visitor', 'bot')),
  body            text not null,
  created_at      timestamptz not null default now()
);

create index messages_conversation_id_idx on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Aide RLS (avec owned_project_ids() de la migration 1) : seule autre fonction SECURITY DEFINER.
-- ---------------------------------------------------------------------------

create function public.owned_conversation_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.conversations c
  join public.projects p on p.id = c.project_id
  where p.owner_id = (select auth.user_id())
$$;

-- ---------------------------------------------------------------------------
-- Fonctions qui portent les limites. SECURITY INVOKER : elles tournent avec les droits d'app_service.
-- ---------------------------------------------------------------------------

-- Réserve une source : verrou sur la ligne du projet, compte (les `uploading` comptent), refuse au-delà
-- de la limite (issue de PLAN_LIMITS, passée en paramètre), puis crée la source en `uploading`.
create function public.reserve_knowledge_source(
  p_project_id  uuid,
  p_title       text,
  p_type        text,
  p_storage_key text,
  p_max_sources integer
)
returns public.knowledge_sources
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count  integer;
  v_source public.knowledge_sources;
begin
  if p_max_sources is null or p_max_sources < 0 then
    raise exception 'invalid_limit' using errcode = '22023';
  end if;

  -- Sérialise les réservations concurrentes d'un même projet.
  perform 1 from public.projects where id = p_project_id for no key update;
  if not found then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;

  select count(*) into v_count from public.knowledge_sources where project_id = p_project_id;
  if v_count >= p_max_sources then
    raise exception 'plan_limit_reached' using errcode = 'P0001';
  end if;

  insert into public.knowledge_sources (project_id, title, type, storage_key, status)
  values (p_project_id, p_title, p_type, p_storage_key, 'uploading')
  returning * into v_source;

  return v_source;
end;
$$;

-- Consomme un message du quota mensuel du projet. Une seule instruction UPDATE : remise à zéro si
-- `period_start` est d'un mois précédent, sinon vérification et incrément. Renvoie true (accepté) ou false (refusé).
create function public.consume_message(
  p_project_id   uuid,
  p_max_messages integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_month_start timestamptz := date_trunc('month', now());
begin
  if p_max_messages is null or p_max_messages < 0 then
    raise exception 'invalid_limit' using errcode = '22023';
  end if;

  update public.projects
  set messages_used = case when period_start < v_month_start then 1 else messages_used + 1 end,
      period_start  = case when period_start < v_month_start then v_month_start else period_start end
  where id = p_project_id
    and (period_start < v_month_start or messages_used < p_max_messages);

  if found then
    return true;
  end if;

  perform 1 from public.projects where id = p_project_id;
  if not found then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;
  return false;
end;
$$;

-- Enregistre un échange : crée la conversation au premier message (p_conversation_id nul), sinon vérifie
-- qu'elle appartient au projet. Insère le message du visiteur puis la réponse du bot. Renvoie l'id de la conversation.
create function public.save_chat_turn(
  p_project_id      uuid,
  p_conversation_id uuid,
  p_visitor_id      text,
  p_visitor_body    text,
  p_bot_body        text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_conversation_id uuid;
begin
  if p_conversation_id is null then
    insert into public.conversations (project_id, visitor_id)
    values (p_project_id, p_visitor_id)
    returning id into v_conversation_id;
  else
    select id into v_conversation_id
    from public.conversations
    where id = p_conversation_id and project_id = p_project_id;
    if not found then
      raise exception 'conversation_not_found' using errcode = 'P0002';
    end if;
  end if;

  -- clock_timestamp() : deux horodatages distincts dans la même transaction, pour l'ordre d'affichage.
  insert into public.messages (conversation_id, role, body, created_at)
  values (v_conversation_id, 'visitor', p_visitor_body, clock_timestamp());
  insert into public.messages (conversation_id, role, body, created_at)
  values (v_conversation_id, 'bot', p_bot_body, clock_timestamp());

  return v_conversation_id;
end;
$$;

-- Recherche par similarité cosinus dans UN projet, uniquement parmi les segments dont la source est `ready`.
create function public.match_chunks(
  p_project_id uuid,
  p_embedding  public.vector,
  p_limit      integer default 5
)
returns table (id uuid, source_id uuid, content text, similarity double precision)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_limit is null or p_limit < 1 then
    raise exception 'invalid_limit' using errcode = '22023';
  end if;

  return query
  select c.id,
         c.source_id,
         c.content,
         1 - (c.embedding operator(public.<=>) p_embedding) as similarity
  from public.knowledge_chunks c
  join public.knowledge_sources s on s.id = c.source_id
  where c.project_id = p_project_id
    and s.status = 'ready'
  order by c.embedding operator(public.<=>) p_embedding
  limit p_limit;
end;
$$;

-- Chiffres du tableau de bord. Droits de l'appelant : la RLS limite les lignes à ses projets.
create function public.owner_activity()
returns table (
  project_id         uuid,
  messages_used      integer,
  period_start       timestamptz,
  conversation_count bigint,
  source_count       bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id,
         p.messages_used,
         p.period_start,
         (select count(*) from public.conversations c where c.project_id = p.id),
         (select count(*) from public.knowledge_sources s where s.project_id = p.id)
  from public.projects p
  order by p.created_at, p.id
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.knowledge_sources enable row level security;
alter table public.knowledge_chunks  enable row level security;
alter table public.conversations     enable row level security;
alter table public.messages          enable row level security;

create policy knowledge_sources_select_own on public.knowledge_sources
  for select to authenticated
  using (project_id in (select public.owned_project_ids()));

create policy knowledge_chunks_select_own on public.knowledge_chunks
  for select to authenticated
  using (project_id in (select public.owned_project_ids()));

create policy conversations_select_own on public.conversations
  for select to authenticated
  using (project_id in (select public.owned_project_ids()));

create policy messages_select_own on public.messages
  for select to authenticated
  using (conversation_id in (select public.owned_conversation_ids()));

-- ---------------------------------------------------------------------------
-- Autorisations : on part de zéro, puis on accorde le strict nécessaire.
-- ---------------------------------------------------------------------------

revoke all on table
  public.knowledge_sources, public.knowledge_chunks, public.conversations, public.messages
  from public, anonymous, authenticated, app_service;

grant select on table
  public.knowledge_sources, public.knowledge_chunks, public.conversations, public.messages
  to authenticated;

-- app_service : traitement des sources et des segments, visiteurs (conversations, messages).
-- TRUNCATE n'est accordé à aucun rôle de l'API ni à app_service (§9).
grant select, insert, update, delete on table public.knowledge_sources to app_service;
grant select, insert, delete         on table public.knowledge_chunks  to app_service;
grant select, insert                 on table public.conversations     to app_service;
grant select, insert                 on table public.messages          to app_service;

revoke all on function public.owned_conversation_ids() from public, anonymous, authenticated, app_service;
grant execute on function public.owned_conversation_ids() to authenticated, app_service;

revoke all on function public.reserve_knowledge_source(uuid, text, text, text, integer)
  from public, anonymous, authenticated, app_service;
grant execute on function public.reserve_knowledge_source(uuid, text, text, text, integer) to app_service;

revoke all on function public.consume_message(uuid, integer)
  from public, anonymous, authenticated, app_service;
grant execute on function public.consume_message(uuid, integer) to app_service;

revoke all on function public.save_chat_turn(uuid, uuid, text, text, text)
  from public, anonymous, authenticated, app_service;
grant execute on function public.save_chat_turn(uuid, uuid, text, text, text) to app_service;

revoke all on function public.match_chunks(uuid, public.vector, integer)
  from public, anonymous, authenticated, app_service;
grant execute on function public.match_chunks(uuid, public.vector, integer) to app_service;

revoke all on function public.owner_activity() from public, anonymous, authenticated, app_service;
grant execute on function public.owner_activity() to authenticated;
