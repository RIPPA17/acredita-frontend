grant execute on function private.create_contractor_invitation_impl(uuid, text, uuid, text, text, text) to authenticated, service_role;
revoke execute on function private.create_contractor_invitation_impl(uuid, text, uuid, text, text, text) from anon, public;
