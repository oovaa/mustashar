import { Hono } from "hono";
import botService from "./botService";
import { serve } from "@hono/node-server";
import postgres from "postgres";

export type Env = {
  GROQ_API_KEY: string;
  BOT_TOKEN: string;
  DATABASE_URL: string;
};

const app = new Hono<{ Bindings: Env }>();
export const sql = postgres(process.env.DATABASE_URL);
const port = 3000;

console.log(`Server is running on port: ${port}`);

app.get("/check", (c) => c.text("Server is healthy !"));
app.post("/", botService);

serve({
  fetch: app.fetch,
  port,
});
