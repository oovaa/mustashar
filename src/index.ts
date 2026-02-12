import { Hono } from "hono";
import { serve } from "@hono/node-server"; // or use Bun.serve
import botService from "./botService";
import "dotenv/config";

const app = new Hono();

// Instead of a Worker environment, we use process.env
app.post("/webhook", async (c) => {
  // Map process.env to the 'c.env' structure your code expects
  c.env = process.env;
  return await botService(c);
});

app.get("/check", (c) => c.text("Server is healthy !"));

console.log("Bot is running on port 3000");

export default {
  fetch: app.fetch,
  port: 3000,
};
