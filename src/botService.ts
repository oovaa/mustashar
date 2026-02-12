import { Context } from "hono";
import { getLLM } from "./llm";
import postgres from "postgres"; // 1. Use postgres.js
import { HumanMessage, SystemMessage } from "langchain";
import { answer } from "./rag/chain";

const botService = async (c: Context) => {
  const sql = postgres(c.env.DATABASE_URL, { ssl: false });

  try {
    const key: string = c.env.GROQ_API_KEY;
    const update = await c.req.json();
    const chat_id = update.message?.chat.id.toString();
    const userText = update.message?.text;

    if (!chat_id || !userText) return c.text("Ok");

    await sql`
    CREATE TABLE IF NOT EXISTS user_memories (
      chat_id TEXT PRIMARY KEY,
      summary TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    )`;

    console.log("Table check/creation complete.");

    try {
      const summarizerLLM = getLLM(key, "llama-3.1-8b-instant", 0);

      // 2. Getting the stored summary
      const result = await sql`
          SELECT summary FROM user_memories WHERE chat_id = ${chat_id}
        `;
      const oldSummary = result[0]?.summary || "No history found";

      // 3. Updating summary
      const updatedSummary = await summarizerLLM.invoke([
        new SystemMessage(`- You are a memory compressor...`),
        new HumanMessage(
          `Current summary: ${oldSummary}. new message: ${userText}`
        ),
      ]);

      // @ts-ignore
      await sql`
          INSERT INTO user_memories (chat_id, summary) 
          VALUES (${chat_id}, ${updatedSummary.content})
          ON CONFLICT (chat_id) DO UPDATE SET summary = ${updatedSummary.content}
        `;

      // 4. Calling the chain
      const finalAnswer = await answer(
        userText,
        updatedSummary.content as string
      );

      // 5. Telegram fetch
      await fetch(
        `https://api.telegram.org/bot${c.env.BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id, text: finalAnswer.content }),
        }
      );
    } catch (err: any) {
      console.error("Error processing update:", err);
    }
  } finally {
    await sql.end(); // 6. ensure connection closes
  }

  return c.text("Ok");
};

export default botService;
