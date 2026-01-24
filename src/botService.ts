import { Context } from "hono";
import { getLLM } from "./llm";
import { neon } from "@neondatabase/serverless";
import { HumanMessage, SystemMessage } from "langchain";

const botService = async (c: Context) => {
  const sql = neon(c.env.DATABASE_URL);

  try {
    const update = await c.req.json();
    const chat_id = update.message?.chat.id.toString();
    const userText = update.message?.text;

    if (chat_id && userText) {
      // 1. Iinitlize 2 llms
      const summarizerLLM = getLLM(
        c.env.GROQ_API_KEY,
        "llama-3.1-8b-instant",
        0,
        100,
      );

      const assistanceLLM = getLLM(
        c.env.GROQ_API_KEY,
        "llama-3.1-8b-instant",
        0.5,
      );
      // we have: qwen/qwen3-32b, but eat a bit much tokens
      // llama-3.1-8b-instant is cheapest one i found

      //2. getting the stored summary
      const result =
        await sql`SELECT summary FROM user_memories WHERE chat_id = ${chat_id}`;
      const oldSummary = result[0]?.summary || "No history found";

      //3. updating the old summary
      const updatedSummary = await summarizerLLM.invoke([
        new SystemMessage(`
          - You are a memory compressor. 
          - Summarize the user's current interests and progress.
          - Keep the total summary under 100 words.
          - Write the summary in english.
  `),
        new HumanMessage(
          `Current summary: ${oldSummary}. new user's message: ${userText}`,
        ),
      ]);

      await sql`
          INSERT INTO user_memories (chat_id, summary) 
          VALUES (${chat_id}, ${updatedSummary.content})
          ON CONFLICT (chat_id) DO UPDATE SET summary = ${updatedSummary.content}
        `;
      // 4. generating the final answer
      const finalAnswer = await assistanceLLM.invoke([
        new SystemMessage(`
         - You are a helpful assistant.
    - ALWAYS prioritize the "Incoming User Message". If the user changes the subject, follow them immediately.
    - Do NOT bring old topics unless they are relevant to the new question.
    - Output MUST be plain text ARABIC. No hashes (#), no symbols, no markdown.
          `),
        new HumanMessage(
          `Stored summary (use it for background only): ${updatedSummary.content}. Incomming user message (follow this now): ${userText}`,
        ),
      ]);

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
