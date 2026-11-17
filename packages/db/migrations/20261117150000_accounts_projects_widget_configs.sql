-- Migration 1 : comptes, projets, configuration du widget (Neon).
-- Additive. RLS, autorisations et fonctions dans la même migration (project.md §7 et §9).
--
-- Prérequis : l'API Data de Neon est activée sur le projet. Elle crée les rôles `anonymous` et
-- `authenticated` (NOLOGIN) et la fonction `auth.user_id()` (claim `sub` du jeton). Cette migration
-- ne les crée pas : si l'API Data n'est pas activée, elle échoue ici, volontairement.

-- ---------------------------------------------------------------------------
-- Rôle de la connexion serveur directe (DATABASE_URL).
-- Créé en SQL : un rôle créé en SQL n'est PAS membre de neon_superuser (doc Neon, « Manage roles »).
-- BYPASSRLS lui est donné explicitement. Aucun mot de passe dans le dépôt : le Product Owner le
-- pose à la main (ALTER ROLE app_service WITH PASSWORD '...'). Sans mot de passe, il ne peut pas se connecter.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_service') then
    create role app_service with login bypassrls;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.accounts (
  clerk_user_id text primary key,
  plan          text not null default 'free' check (plan in ('free', 'pro')),
  created_at    timestamptz not null default now()
);

create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  owner_id      text not null references public.accounts (clerk_user_id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 100),
  public_key    text not null unique,
  messages_used integer not null default 0 check (messages_used >= 0),
  period_start  timestamptz not null default date_trunc('month', now()),
  created_at    timestamptz not null default now()
);

create index projects_owner_id_idx on public.projects (owner_id);

create table public.widget_configs (
  project_id   uuid primary key references public.projects (id) on delete cascade,
  button_color text not null default '#000000' check (button_color ~ '^#[0-9a-fA-F]{6}$'),
  position     text not null default 'bottom-right'
                 check (position in ('bottom-right', 'bottom-left', 'top-right', 'top-left')),
  label        text not null default 'Besoin d''aide ?' check (char_length(btrim(label)) between 1 and 40),
  animation    text not null default 'fade' check (animation in ('fade', 'slide', 'scale')),
  header_text  text not null default 'Assistant' check (char_length(btrim(header_text)) between 1 and 60),
  show_badge   boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Aide RLS : seule fonction SECURITY DEFINER.
-- ---------------------------------------------------------------------------

create function public.owned_project_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.projects p
  where p.owner_id = (select auth.user_id())
$$;

-- ---------------------------------------------------------------------------
-- create_project : vérifie la limite et crée le projet + sa config, atomiquement.
-- ---------------------------------------------------------------------------

create function public.create_project(
  p_owner_id     text,
  p_name         text,
  p_max_projects integer
)
returns public.projects
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count   integer;
  v_project public.projects;
begin
  -- Le verrou sur la ligne du compte sérialise les appels concurrents du même propriétaire.
  perform 1 from public.accounts where clerk_user_id = p_owner_id for update;
  if not found then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;

  select count(*) into v_count from public.projects where owner_id = p_owner_id;
  if v_count >= p_max_projects then
    raise exception 'plan_limit_reached' using errcode = 'P0001';
  end if;

  insert into public.projects (owner_id, name, public_key)
  values (p_owner_id, p_name, 'pk_' || replace(gen_random_uuid()::text, '-', ''))
  returning * into v_project;

  insert into public.widget_configs (project_id) values (v_project.id);

  return v_project;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.accounts       enable row level security;
alter table public.projects       enable row level security;
alter table public.widget_configs enable row level security;

-- accounts : aucune politique pour authenticated, donc aucun accès. app_service contourne la RLS.

create policy projects_select_own on public.projects
  for select to authenticated
  using (owner_id = (select auth.user_id()));

create policy projects_update_own on public.projects
  for update to authenticated
  using (owner_id = (select auth.user_id()))
  with check (owner_id = (select auth.user_id()));

create policy projects_delete_own on public.projects
  for delete to authenticated
  using (owner_id = (select auth.user_id()));

create policy widget_configs_select_own on public.widget_configs
  for select to authenticated
  using (project_id in (select public.owned_project_ids()));

-- ---------------------------------------------------------------------------
-- Autorisations : on part de zéro (l'API Data accorde des privilèges par défaut à `authenticated`
-- sur les futures tables), puis on accorde le strict nécessaire.
-- ---------------------------------------------------------------------------

revoke all on table public.accounts, public.projects, public.widget_configs
  from public, anonymous, authenticated, app_service;

grant usage on schema public to app_service;

grant select, insert, update, delete on table public.accounts, public.projects, public.widget_configs
  to app_service;
-- TRUNCATE n'est accordé à aucun rôle de l'API ni à app_service (§9).

grant select on table public.projects, public.widget_configs to authenticated;
grant update (name) on table public.projects to authenticated;
grant delete on table public.projects to authenticated;

revoke all on function public.owned_project_ids() from public, anonymous, authenticated, app_service;
grant execute on function public.owned_project_ids() to authenticated, app_service;

revoke all on function public.create_project(text, text, integer)
  from public, anonymous, authenticated, app_service;
grant execute on function public.create_project(text, text, integer) to app_service;
