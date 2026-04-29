-- Tighten RLS so authenticated (including anonymous) users only access their own rows.
-- This avoids shared rows with NULL user_id while keeping anonymous sessions functional.

-- Images
DROP POLICY IF EXISTS "Users can view own images" ON images;
DROP POLICY IF EXISTS "Users can insert images" ON images;
DROP POLICY IF EXISTS "Users can update own images" ON images;
DROP POLICY IF EXISTS "Users can manage own images" ON images;

CREATE POLICY "Users can view own images" ON images
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own images" ON images
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own images" ON images
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own images" ON images
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Canvas sessions
DROP POLICY IF EXISTS "Users can view own canvas sessions" ON canvas_sessions;
DROP POLICY IF EXISTS "Users can manage own canvas sessions" ON canvas_sessions;

CREATE POLICY "Users can view own canvas sessions" ON canvas_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own canvas sessions" ON canvas_sessions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- AI edits
DROP POLICY IF EXISTS "Users can view own AI edits" ON ai_edits;
DROP POLICY IF EXISTS "Users can insert AI edits" ON ai_edits;

CREATE POLICY "Users can view own AI edits" ON ai_edits
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert AI edits" ON ai_edits
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
