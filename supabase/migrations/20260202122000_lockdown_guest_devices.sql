-- Lock down guest_devices from client access (service_role can still access)
REVOKE ALL ON public.guest_devices FROM anon;
REVOKE ALL ON public.guest_devices FROM authenticated;

DROP POLICY IF EXISTS "Guests can read own record" ON public.guest_devices;
DROP POLICY IF EXISTS "Guests can insert own record" ON public.guest_devices;
DROP POLICY IF EXISTS "Guests can update own record" ON public.guest_devices;
