import { Context } from "hono";
import { getLLM } from "./llm";
import postgres from "postgres";

const botService = async (c: Context) => {
  const sql = postgres(c.env.DATABASE_URL, {
    ssl: "prefer",
  });

  try {
    const update = await c.req.json();
    const chat_id = update.message?.chat.id.toString();
    const userText = update.message?.text;

    if (chat_id && userText) {
      // 1. Iinitlize 2 llms
      const summarizerLLM = getLLM(c.env.GROQ_API_KEY);
      const assistanceLLM = getLLM(c.env.GROQ_API_KEY);

      //2. getting the stored summary
      const result =
        await sql`SELECT summary FROM user_memories WHERE chat_id = ${chat_id}`;
      const oldSummary = result[0]?.summary || "No history found";

      //3. updating the old summary
      const updatedSummary = await summarizerLLM.invoke(
        `Update the summary. Old: ${oldSummary}. new message: ${userText}.`,
      );
      const newSummary = updatedSummary.content;

      // @ts-ignore
      await sql`
          INSERT INTO user_memories (chat_id, summary) 
          VALUES (${chat_id}, ${newSummary})
          ON CONFLICT (chat_id) DO UPDATE SET summary = ${newSummary}
        `;
      // 4. generating the final answer
      const finalAnswer = await assistanceLLM.invoke(
        `- the past messages's summary: ${newSummary}\n - the comming user message: ${userText}`,
      );

      // 5. sending back the answer to the bot
      await fetch(
        `https://api.telegram.org/bot${c.env.BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chat_id, text: finalAnswer.content }),
        },
      );
    }
  } catch (err) {
    console.error("Error processing update:", err);
  }

  return c.text("Ok");
};

export default botService;
