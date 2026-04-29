-- Restrict app_logs insert to authenticated users only
DROP POLICY IF EXISTS "Allow insert app logs" ON public.app_logs;
CREATE POLICY "Allow insert app logs" ON public.app_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
