import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import neo4j from "npm:neo4j-driver";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const NEO4J_URI = Deno.env.get("NEO4J_URI")!;
const NEO4J_USERNAME = Deno.env.get("NEO4J_USERNAME")!;
const NEO4J_PASSWORD = Deno.env.get("NEO4J_PASSWORD")!;

const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
);

async function executeCypherQuery(query: string) {
  const session = driver.session();
  try {
    const result = await session.run(query);

    const nodes = new Map();
    const links = [];

    result.records.forEach(record => {
      // Try to find nodes and relationships in the record
      const recordKeys = record.keys;
      let nodeN = null;
      let nodeM = null;
      let relationship = null;

      // This is a naive implementation that assumes the query returns paths or nodes and relationships
      // A more robust implementation would inspect the types of the returned values
      for (const key of recordKeys) {
        const value = record.get(key);
        if (value.constructor.name === 'Node') {
          if (!nodeN) {
            nodeN = value;
          } else if (!nodeM) {
            nodeM = value;
          }
        } else if (value.constructor.name === 'Relationship') {
          relationship = value;
        }
      }
      
      if(nodeN && !nodeM && !relationship){
         if (!nodes.has(nodeN.identity.toString())) {
            nodes.set(nodeN.identity.toString(), {
              id: nodeN.identity.toString(),
              label: nodeN.properties.name || nodeN.labels[0],
              group: nodeN.labels[0],
              ...nodeN.properties
            });
          }
      }

      if (nodeN && nodeM && relationship) {
        if (!nodes.has(nodeN.identity.toString())) {
          nodes.set(nodeN.identity.toString(), {
            id: nodeN.identity.toString(),
            label: nodeN.properties.name || nodeN.labels[0],
            group: nodeN.labels[0],
            ...nodeN.properties
          });
        }
        if (!nodes.has(nodeM.identity.toString())) {
          nodes.set(nodeM.identity.toString(), {
            id: nodeM.identity.toString(),
            label: nodeM.properties.name || nodeM.labels[0],
            group: nodeM.labels[0],
            ...nodeM.properties
          });
        }

        links.push({
          source: relationship.start.toString(),
          target: relationship.end.toString(),
          label: relationship.type,
          ...relationship.properties
        });
      }
    });

    return {
      nodes: Array.from(nodes.values()),
      links: links
    };
  } finally {
    await session.close();
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query) {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const graphData = await executeCypherQuery(query);
    return new Response(JSON.stringify(graphData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(String(err?.message ?? err), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
