-- Create a table to store chat history
CREATE TABLE
  public.chat_history (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    session_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT,
    thinking_steps TEXT
  );

-- Optional: Add RLS policies for client-side access in the future.
-- For now, access is restricted to the backend (Edge Functions).
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own chat history.
-- This is commented out as we will implement loading history later.
-- CREATE POLICY "Allow authenticated user to read their own chat history"
-- ON public.chat_history
-- FOR SELECT
-- TO authenticated
-- USING (auth.uid() = (SELECT raw_user_meta_data->>'session_id' FROM auth.users WHERE id = auth.uid())::uuid);