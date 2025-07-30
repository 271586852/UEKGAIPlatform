-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table to store your documents
create table
  ue_documents (
    id bigserial primary key,
    content text,
    embedding vector(1536)
  );

-- Create a function to search for documents
create function match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    id,
    content,
    1 - (ue_documents.embedding <=> query_embedding) as similarity
  from
    ue_documents
  where 1 - (ue_documents.embedding <=> query_embedding) > match_threshold
  order by
    similarity desc
  limit
    match_count;
end;
$$;
