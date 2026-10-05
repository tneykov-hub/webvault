-- Explicit service-only policies document the intended private-table access.
-- Authenticated/anonymous roles retain no direct grants or permissive policies.
create policy "Service role only" on webvault_private.device_security_settings for all to service_role using(true) with check(true);
create policy "Service role only" on webvault_private.devices for all to service_role using(true) with check(true);
create policy "Service role only" on webvault_private.device_leases for all to service_role using(true) with check(true);
create policy "Service role only" on webvault_private.device_confirmations for all to service_role using(true) with check(true);
