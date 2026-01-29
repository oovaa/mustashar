import { Hono } from "hono";
import botService from "./botService";
import postgres from "postgres";

export type Env = {
  GROQ_API_KEY: string;
  BOT_TOKEN: string;
  DATABASE_URL: string;
};

const app = new Hono<{ Bindings: Env }>();
export const sql = postgres(process.env.DATABASE_URL as string);
export const keys: string[] = JSON.parse(process.env.GROQ_API_KEYS as string);
const port = 5000;

console.log(`Server is running on port: ${port}`);

app.get("/check", (c) => c.text("Server is healthy !"));
app.post("/", botService);

export default {
  port,
  fetch: app.fetch,
};