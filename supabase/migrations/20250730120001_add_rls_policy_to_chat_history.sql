-- Create a policy to allow anyone to insert into the chat_history table.
-- This is necessary because we enabled Row Level Security (RLS) on the table,
-- which by default denies all access. Edge Functions, when called from the client,
-- use the user's role (in this case, 'anon' for public users).
-- This policy grants the public (and therefore anon) role permission to insert data.
CREATE POLICY "Allow public insert access"
ON public.chat_history
FOR INSERT
TO public
WITH CHECK (true);