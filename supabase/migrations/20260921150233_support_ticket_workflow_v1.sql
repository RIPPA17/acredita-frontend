begin;

alter table public.support_tickets
  add constraint support_tickets_subject_length_chk
    check (char_length(btrim(subject)) between 3 and 160),
  add constraint support_tickets_description_length_chk
    check (char_length(btrim(description)) between 1 and 3000);

create or replace function private.enforce_support_ticket_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.project_id is distinct from old.project_id
     or new.accreditation_id is distinct from old.accreditation_id
     or new.created_by is distinct from old.created_by then
    raise exception 'No se puede cambiar el proyecto, la acreditación ni el creador de un ticket existente.'
      using errcode = '23514';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'cerrado' then
      raise exception 'Un ticket cerrado no puede reabrirse.'
        using errcode = '23514';
    elsif old.status = 'abierto' and new.status not in ('en_progreso', 'resuelto') then
      raise exception 'Transición de ticket inválida: abierto -> %.', new.status
        using errcode = '23514';
    elsif old.status = 'en_progreso' and new.status not in ('esperando_usuario', 'resuelto') then
      raise exception 'Transición de ticket inválida: en_progreso -> %.', new.status
        using errcode = '23514';
    elsif old.status = 'esperando_usuario' and new.status not in ('en_progreso', 'resuelto') then
      raise exception 'Transición de ticket inválida: esperando_usuario -> %.', new.status
        using errcode = '23514';
    elsif old.status = 'resuelto' and new.status not in ('en_progreso', 'cerrado') then
      raise exception 'Transición de ticket inválida: resuelto -> %.', new.status
        using errcode = '23514';
    end if;
  end if;

  if new.status in ('resuelto', 'cerrado') and btrim(coalesce(new.resolution, '')) = '' then
    raise exception 'Debes indicar la resolución aplicada.'
      using errcode = '23514';
  end if;

  if new.status = 'en_progreso'
     and new.assigned_to is null
     and (select auth.uid()) is not null
     and (
       (select private.is_acredita_staff())
       or (select private.can_manage_project(new.project_id))
     ) then
    new.assigned_to := (select auth.uid());
  end if;

  if new.status = 'resuelto' then
    new.resolved_at := coalesce(new.resolved_at, now());
    new.closed_at := null;
  elsif new.status = 'cerrado' then
    new.resolved_at := coalesce(new.resolved_at, now());
    new.closed_at := coalesce(new.closed_at, now());
  else
    new.resolution := null;
    new.resolved_at := null;
    new.closed_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists support_tickets_lifecycle_guard on public.support_tickets;
create trigger support_tickets_lifecycle_guard
before update on public.support_tickets
for each row execute function private.enforce_support_ticket_lifecycle();

create or replace function private.guard_support_ticket_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.support_tickets%rowtype;
  v_uid uuid := (select auth.uid());
  v_support_author boolean := false;
begin
  if v_uid is null or new.author_id is distinct from v_uid then
    raise exception 'No puedes enviar mensajes en nombre de otra persona.'
      using errcode = '42501';
  end if;

  select *
    into v_ticket
    from public.support_tickets
   where id = new.ticket_id
   for update;

  if not found or not (select private.can_access_support_ticket(new.ticket_id)) then
    raise exception 'No tienes acceso a este ticket.'
      using errcode = '42501';
  end if;

  if v_ticket.status = 'cerrado' then
    raise exception 'El ticket está cerrado y no admite nuevas respuestas.'
      using errcode = '23514';
  end if;

  v_support_author :=
    (select private.is_acredita_staff())
    or (select private.can_manage_project(v_ticket.project_id));

  if new.is_internal and not v_support_author then
    raise exception 'Las notas internas están reservadas al equipo de soporte.'
      using errcode = '42501';
  end if;

  if not new.is_internal
     and not v_support_author
     and v_ticket.status in ('resuelto', 'esperando_usuario') then
    update public.support_tickets
       set status = 'en_progreso',
           resolution = null,
           resolved_at = null,
           closed_at = null
     where id = new.ticket_id;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_support_ticket_message() from public;

drop trigger if exists support_ticket_messages_guard on public.support_ticket_messages;
create trigger support_ticket_messages_guard
before insert on public.support_ticket_messages
for each row execute function private.guard_support_ticket_message();

revoke update, delete on table public.support_ticket_messages from authenticated;
revoke delete on table public.support_tickets from authenticated;

commit;
