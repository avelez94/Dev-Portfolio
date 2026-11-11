-- Hardening from the Supabase security advisor: carrier_qualification ran with the owner's
-- rights, so any signed in account (even one without an active staff profile) could read a
-- carrier's qualification flags through the API. It now runs with the caller's rights, so
-- row level security applies: staff see the result, anyone else sees every check as false.
-- The shipment assignment trigger is unaffected (it runs with elevated rights and still sees
-- every record).
alter function public.carrier_qualification(uuid, date) security invoker;
