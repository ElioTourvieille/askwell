-- P3C-T09 : récupérer les envois abandonnés (project.md §6.4).
-- Une source `uploading` créée il y a plus de 2 heures ne compte plus dans la limite du plan.
-- Migration additive : `create or replace` de la même fonction (même signature, même type de retour,
-- SECURITY INVOKER, search_path vide). Aucune table, colonne ni politique RLS modifiée.

create or replace function public.reserve_knowledge_source(
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

  -- Un envoi `uploading` de plus de 2 heures est abandonné : il ne bloque plus d'emplacement.
  select count(*) into v_count
  from public.knowledge_sources
  where project_id = p_project_id
    and not (status = 'uploading' and created_at < now() - interval '2 hours');
  if v_count >= p_max_sources then
    raise exception 'plan_limit_reached' using errcode = 'P0001';
  end if;

  insert into public.knowledge_sources (project_id, title, type, storage_key, status)
  values (p_project_id, p_title, p_type, p_storage_key, 'uploading')
  returning * into v_source;

  return v_source;
end;
$$;

-- Droits inchangés : seul app_service exécute la fonction.
revoke all on function public.reserve_knowledge_source(uuid, text, text, text, integer)
  from public, anonymous, authenticated, app_service;
grant execute on function public.reserve_knowledge_source(uuid, text, text, text, integer) to app_service;
