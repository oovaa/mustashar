import "dotenv/config";
import express from "express";
import botService from "./botService";
import postgres from "postgres";
import { messagesCount, messagesByDate, usersCount } from "./analytics";

const app = express();
app.use(express.json());

export const sql = postgres(process.env.DATABASE_URL!, { ssl: false });
export const BOT_TOKEN = process.env.BOT_TOKEN;
export const GROQ_API_KEY = process.env.GROQ_API_KEY;

app.post("/webhook", botService);
app.get("/check", async (req, res) => {
  try {
    await sql`SELECT 1`;
    res.send("Server and database are healthy!");
  } catch (error) {
    res.status(500).send("Database connection failed");
  }
});

// analytics endpoints
app.get("/users", usersCount);
app.get("/messages", messagesCount);
app.get("/messages/:date", messagesByDate);

const port = 3000;
app.listen(port, () => {
  console.log(`Bot is running on port ${port}`);
});
