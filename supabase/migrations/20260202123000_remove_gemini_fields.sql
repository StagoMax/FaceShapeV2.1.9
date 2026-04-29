-- Remove unused Gemini-specific fields
ALTER TABLE public.ai_edits
  DROP COLUMN IF EXISTS gemini_response;
