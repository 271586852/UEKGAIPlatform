// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Safely parse the request body. If it's empty or not JSON, proceed as if no sessionId was passed.
    let sessionId: string | null = null;
    try {
      const body = await req.json();
      sessionId = body.sessionId;
    } catch (e) {
      // This is expected when no body is sent, e.g., for fetching the session list.
    }

    // Create a Supabase client with the user's token.
    // This will work for both local development and deployed functions.
    // In local dev, SUPABASE_URL is injected by the CLI.
    // In the cloud, we expect PROJECT_URL and PROJECT_ANON_KEY to be set as secrets.
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("PROJECT_ANON_KEY");

    const supabaseClient = createClient(
      supabaseUrl ?? "",
      supabaseAnonKey ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    let data, error;

    if (sessionId) {
      // Feature 1: Fetch all messages for a specific session
      ({ data, error } = await supabaseClient
        .from("chat_history")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true }))
    } else {
      // Feature 2: Fetch the list of all unique sessions for the sidebar
      ({ data, error } = await supabaseClient.rpc("get_chat_sessions"))
    }

    if (error) throw error

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })
  } catch (err) {
    return new Response(String(err?.message ?? err), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})
