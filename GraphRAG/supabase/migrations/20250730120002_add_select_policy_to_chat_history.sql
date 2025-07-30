-- This policy allows public (anon) users to read all records from the chat_history table.
-- In a production application with multiple users, you would typically restrict this
-- to only allow users to read their OWN chat history, for example by matching auth.uid().
-- For this single-user application, allowing public read access is sufficient and safe.
CREATE POLICY "Allow public read access"
ON public.chat_history
FOR SELECT
TO public
USING (true);