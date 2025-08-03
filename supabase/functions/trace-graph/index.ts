import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import neo4j from "npm:neo4j-driver";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NEO4J_URI = Deno.env.get("NEO4J_URI")!;
const NEO4J_USERNAME = Deno.env.get("NEO4J_USERNAME")!;
const NEO4J_PASSWORD = Deno.env.get("NEO4J_PASSWORD")!;

const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
);

function processRecords(records: any[]) {
    const nodes = new Map();
    const links: any[] = [];
    records.forEach(record => {
        const path = record.get('p');
        path.segments.forEach((segment: any) => {
            const startNode = segment.start;
            const endNode = segment.end;
            const relationship = segment.relationship;

            if (!nodes.has(startNode.identity.toString())) {
                nodes.set(startNode.identity.toString(), {
                    id: startNode.identity.toString(),
                    label: startNode.properties.name || startNode.labels[0],
                    ...startNode.properties
                });
            }
            if (!nodes.has(endNode.identity.toString())) {
                nodes.set(endNode.identity.toString(), {
                    id: endNode.identity.toString(),
                    label: endNode.properties.name || endNode.labels[0],
                    ...endNode.properties
                });
            }
            links.push({
                source: relationship.start.toString(),
                target: relationship.end.toString(),
                label: relationship.type,
                ...relationship.properties
            });
        });
    });
    return { nodes: Array.from(nodes.values()), links };
}


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { nodeId, direction } = await req.json();

    if (!nodeId || !direction) {
      throw new Error("Missing nodeId or direction");
    }

    const query = direction === 'UPSTREAM'
      ? `MATCH p=(downstream)-[:DEPENDS_ON*1..10]->(upstream) WHERE id(upstream) = ${nodeId} RETURN p`
      : `MATCH p=(downstream)-[:DEPENDS_ON*1..10]->(upstream) WHERE id(downstream) = ${nodeId} RETURN p`;

    const session = driver.session();
    let graphData;
    try {
      const result = await session.run(query);
      graphData = processRecords(result.records);
    } finally {
      await session.close();
    }

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
