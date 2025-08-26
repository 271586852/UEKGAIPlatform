import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// Use the OpenAI client but point it to the Moonshot API, same as rag-query
import { ChatOpenAI } from "npm:@langchain/openai@^0.2.1";
import { PromptTemplate } from "npm:@langchain/core@^0.2.5/prompts";
import { StringOutputParser } from "npm:@langchain/core@^0.2.5/output_parsers";


// --- Prompt Template Definition ---
const PROMPT_TEMPLATE = `
你是一个专业的 Neo4j 图数据库专家。你的任务是将用户的自然语言问题转换成 Cypher 查询语句。
请严格根据下面提供的图谱 Schema 信息来生成查询，不要使用 Schema 中不存在的标签、关系或属性。

# 图谱 Schema:
{schema}

# 规则:
1.  只生成 Cypher 查询语句，不要包含任何额外的解释或文字。
2.  如果问题无法根据现有 Schema 回答，请返回一条错误信息，内容为 "ERROR: Query cannot be answered with the current schema."。
3.  将生成的 Cypher 语句包裹在 \`\`\`cypher ... \`\`\` 中。
4.  在匹配节点时，优先使用 'name' 或 'title' 等属性进行过滤。

# 示例:
- 问题: "查找论文 'GraphRAG' 提到了哪些概念?"
- Cypher:
\`\`\`cypher
MATCH (p:Paper {{title: 'GraphRAG'}})-[:MENTIONS]->(c:Concept)
RETURN c.name
\`\`\`
- 问题: "作者 '李明' 发表过哪些期刊?"
- Cypher:
\`\`\`cypher
MATCH (a:Author {{name: '李明'}})-[:WROTE]->(p:Paper)-[:PUBLISHED_IN]->(j:Journal)
RETURN DISTINCT j.name
\`\`\`
- 问题: "2023年之后发表了哪些关于'大语言模型'的论文？"
- Cypher:
\`\`\`cypher
MATCH (p:Paper)-[:MENTIONS]->(c:Concept {{name: '大语言模型'}})
WHERE p.year > 2023
RETURN p.title
\`\`\`

# 用户问题:
{question}

# 生成的 Cypher 查询:
`;

const promptTemplate = new PromptTemplate({
  template: PROMPT_TEMPLATE,
  inputVariables: ["schema", "question"],
});
// --- End of Prompt Template Definition ---


// This is a shared CORS header file.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// The schema for your graph.
const graphSchema = `
- 节点标签和属性:
  - Paper: {title: STRING, year: INTEGER, abstract: STRING, id: STRING}
  - Author: {name: STRING, affiliation: STRING, id: STRING}
  - Concept: {name: STRING, id: STRING}
  - Journal: {name: STRING, id: STRING}
- 关系类型:
  - (Author)-[:WROTE]->(Paper)
  - (Paper)-[:MENTIONS]->(Concept)
  - (Paper)-[:PUBLISHED_IN]->(Journal)
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { question } = await req.json();
    if (!question) {
      throw new Error("Question is required.");
    }
    
    // Instantiate the OpenAI model but configure it to use Tongyi Qianwen's API
    const llm = new ChatOpenAI({ 
      openAIApiKey: Deno.env.get("OPENAI_API_KEY"), // Using the same key as rag-query
      modelName: "qwen-plus", 
      temperature: 0,
      configuration: {
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      },
    });
    
    // Using the modern LangChain Expression Language (LCEL) chain
    const chain = promptTemplate.pipe(llm).pipe(new StringOutputParser());

    const result = await chain.invoke({
      schema: graphSchema,
      question: question,
    });

    const cypherMatch = result.match(/```cypher\n([\s\S]*?)\n```/);
    const cypherQuery = cypherMatch 
      ? cypherMatch[1].trim() 
      : (result.includes("ERROR:") ? result : "ERROR: Failed to generate a valid Cypher query.");

    return new Response(
      JSON.stringify({ cypher: cypherQuery }),
      { 
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json" 
        } 
      }
    );
  } catch (error) {
    console.error("Error in function:", error);
    return new Response(JSON.stringify({ error: error.message }), 
    { 
      headers: { 
        ...corsHeaders,
        "Content-Type": "application/json" 
      },
      status: 500 
    });
  }
});