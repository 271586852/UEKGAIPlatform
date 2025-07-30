-- Create a PostgreSQL function to get the list of unique chat sessions.
-- This function is more efficient than querying the table directly from the Edge Function,
-- as it performs the aggregation and ordering at the database level.
CREATE OR REPLACE FUNCTION get_chat_sessions()
RETURNS TABLE (
  session_id UUID,
  first_message TEXT,
  last_updated TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH session_first_message AS (
    SELECT
      h.session_id,
      -- Get the content of the first message (ordered by creation time) for each session
      FIRST_VALUE(h.content) OVER (PARTITION BY h.session_id ORDER BY h.created_at) as first_message,
      -- Get the timestamp of the last message for each session
      MAX(h.created_at) OVER (PARTITION BY h.session_id) as last_updated,
      -- Assign a row number to each message within a session
      ROW_NUMBER() OVER (PARTITION BY h.session_id ORDER BY h.created_at) as rn
    FROM
      public.chat_history h
  )
  -- Select only the unique sessions (the first row for each session)
  -- and order them by the most recently updated.
  SELECT
    sfm.session_id,
    sfm.first_message,
    sfm.last_updated
  FROM
    session_first_message sfm
  WHERE
    sfm.rn = 1
  ORDER BY
    sfm.last_updated DESC;
END;
$$ LANGUAGE plpgsql;