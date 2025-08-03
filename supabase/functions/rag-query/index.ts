// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import OpenAI from "openai"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// This is the new prompt that instructs the model to produce a thinking process.
const getPrompt = (query: string, context: string) => `You are a helpful assistant for the Unreal Engine Knowledge Graph. Your task is to answer the user's question based on the provided context.
First, provide your step-by-step thinking process inside <thinking> XML tags. This should explain how you are using the context to arrive at the answer.
Second, provide the final, user-facing answer inside <answer> XML tags. The answer should be concise and directly address the user's question. Make sure your entire response is contained within these tags.

Context:
---
${context}
---

Question:
${query}`

// This transform stream extracts only the content between <answer> tags
// for the client to display with a typewriter effect.
// This is the final, robust version that correctly handles all chunk-splitting scenarios.
function createAnswerStream(): TransformStream<Uint8Array, Uint8Array> {
  let buffer = ""
  let inAnswer = false
  const startTag = "<answer>"
  const endTag = "</answer>"
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  return new TransformStream({
    transform(chunk, controller) {
      // Append new data to the buffer. stream: true handles multi-byte chars correctly.
      buffer += decoder.decode(chunk, { stream: true })

      // Process buffer as long as there's something actionable
      while (true) {
        if (!inAnswer) {
          const startIndex = buffer.indexOf(startTag)
          if (startIndex === -1) {
            // No start tag found yet, wait for more data.
            return
          }
          // Found start tag, discard everything before it and switch mode.
          buffer = buffer.substring(startIndex + startTag.length)
          inAnswer = true
        }

        if (inAnswer) {
          const endIndex = buffer.indexOf(endTag)
          if (endIndex === -1) {
            // We are in an answer, but the end tag is not in the current buffer.
            // We must wait for more data to arrive.
            return
          }

          // Found an end tag. Enqueue the content before it.
          const contentToEnqueue = buffer.substring(0, endIndex)
          controller.enqueue(encoder.encode(contentToEnqueue))

          // Discard the processed content and the tag, then switch mode.
          buffer = buffer.substring(endIndex + endTag.length)
          inAnswer = false
          // IMPORTANT: Loop again immediately to process the rest of the buffer,
          // which might contain another complete <answer>...</answer> block.
        }
      }
    },
  })
}

// This function consumes the entire LLM response, parses it, and saves it to the database.
async function logRequestAndResponse(
  stream: ReadableStream<Uint8Array>,
  supabaseClient: SupabaseClient,
  sessionId: string,
  query: string
) {
  let fullResponse = ""
  const reader = stream.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    fullResponse += new TextDecoder().decode(value)
  }

  const thinkingMatch = fullResponse.match(/<thinking>([\s\S]*?)<\/thinking>/)
  const answerMatch = fullResponse.match(/<answer>([\s\S]*?)<\/answer>/)
  const thinkingSteps = thinkingMatch ? thinkingMatch[1].trim() : ""
  const finalAnswer = answerMatch ? answerMatch[1].trim() : "Sorry, I could not generate a valid answer."

  const { error } = await supabaseClient.from("chat_history").insert({
    session_id: sessionId,
    role: "assistant",
    content: finalAnswer,
    thinking_steps: thinkingSteps,
  })

  if (error) {
    console.error("Failed to save assistant response:", error)
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("PROJECT_ANON_KEY");

    const supabaseClient = createClient(
      supabaseUrl ?? '',
      supabaseAnonKey ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    
    const { data: documents, error } = await supabaseClient
      .from('ue_documents')
      .select('content');

    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    // Combine the content of all documents into a single context string
    const context = documents?.map(d => d.content).join('\n---\n') || '';


    const { query, sessionId } = await req.json()
    if (!query || !sessionId) {
      throw new Error("Missing 'query' or 'sessionId' in the request body.")
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")
    if (!openaiApiKey) {
      throw new Error("Missing environment variable OPENAI_API_KEY")
    }
    const kimi = new OpenAI({
      apiKey: openaiApiKey,
      baseURL: "https://api.moonshot.cn/v1",
    })

    // Persist user's message
    const { error: userError } = await supabaseClient.from("chat_history").insert({
      session_id: sessionId,
      role: "user",
      content: query,
    })
    if (userError) throw userError

    const prompt = getPrompt(query, context)

    // Call Kimi API with streaming enabled
    const llmStream = await kimi.chat.completions.create({
      model: "moonshot-v1-8k",
      messages: [
        { role: "system", content: "You are a helpful and concise assistant." },
        { role: "user", content: prompt },
      ],
      stream: true,
    })

    // Manually create a new ReadableStream to convert the LLM's chunk objects into a raw text stream.
    const textEncoder = new TextEncoder()
    const rawTextStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of llmStream) {
          const content = chunk.choices[0]?.delta?.content || ""
          if (content) {
            controller.enqueue(textEncoder.encode(content))
          }
        }
        controller.close()
      },
    })

    // We need to process the stream in two ways:
    // 1. Send a clean, answer-only stream to the client.
    // 2. Log the full raw response (with thinking steps) to the database.
    // `tee()` creates two independent streams from one source.
    const [logStream, clientStream] = rawTextStream.tee()

    // Start logging in the background, without waiting for it to finish.
    logRequestAndResponse(logStream, supabaseClient, sessionId, query)

    // Create the answer-only stream and return it to the client.
    const answerStream = clientStream.pipeThrough(createAnswerStream())

    return new Response(answerStream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      status: 200,
    })
  } catch (error) {
    console.error("Error in Edge Function:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/rag-query' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
