revoke all privileges on table public.notification_preferences from anon;
revoke all privileges on table public.notification_reads from anon;

revoke delete, truncate, references, trigger on table public.notification_preferences from authenticated;
revoke delete, truncate, references, trigger on table public.notification_reads from authenticated;

grant select, insert, update on table public.notification_preferences to authenticated;
grant select, insert, update on table public.notification_reads to authenticated;
