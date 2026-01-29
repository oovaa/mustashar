import { Hono } from "hono";
import { serveStatic } from '@hono/node-server/serve-static';
import botService from "./botService";
import { searchDatabase, generateAnswer } from "./rag";
import { config } from 'dotenv';

config();

export type Env = {
  GROQ_API_KEY: string;
  BOT_TOKEN: string;
  DATABASE_URL: string;
};

const app = new Hono<{ Bindings: Env }>();

app.get("/check", (c) => c.text("Server is healthy !"));

// RAG endpoint
app.post("/api/ask", async (c) => {
  try {
    const body = await c.req.json();
    const question: string = body.question;

    if (!question) return c.json({ error: "Missing question" }, 400);

    console.log(`\n Question: ${question}`);

    // Search the vector database for relevant chunks
    const matches = await searchDatabase(question, 5);
    
    console.log(` Found ${matches.length} relevant chunks`);
    matches.forEach((m, idx) => {
      console.log(`\n[${idx + 1}] Distance: ${m._distance.toFixed(4)} (lower = more similar)`);
      console.log(m.text.slice(0, 200) + '...');
    });

    // Extract only the text for the LLM
    const chunks = matches.map((m) => m.text);

    // Generate answer using LLM with the retrieved chunks
    const apiKey = process.env.GROQ_API_KEY || c.env?.GROQ_API_KEY;
    if (!apiKey) {
      return c.json({ error: "GROQ_API_KEY not configured" }, 500);
    }
    
    const answer = await generateAnswer(question, chunks, apiKey);
    
    console.log(` Answer generated\n`);

    return c.json({ answer });
  } catch (error: any) {
    console.error("Error:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Telegram bot webhook
app.post("/", botService);

export default app;
