import { Context } from "hono";
import { getLLM } from "./llm";
import { HumanMessage, SystemMessage } from "langchain";
import fallback from "./fallback";
import { keys, sql } from ".";

const botService = async (c: Context) => {
  let key = keys[0];
  const update = await c.req.json();
  console.log(process.env);
  

  let loopTimes = 0;
  while (loopTimes < keys.length) {
    try {
      const chat_id = update.message?.chat.id.toString();
      const userText = update.message?.text;

      if (chat_id && userText) {
        // 1. Iinitlize 2 llms
        const summarizerLLM = getLLM(key, "llama-3.1-8b-instant", 0, 100);

        const assistanceLLM = getLLM(
          key,
          "llama-3.1-8b-instant", // i found 2 options: llama-3.1-8b-instant: Cheapest, openai/gpt-oss-20b: Better, not much Cheaper
          0.5,
        );

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

        // @ts-ignore
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
            body: JSON.stringify({
              chat_id: chat_id,
              text: finalAnswer.content,
            }),
          },
        );
        break;
      }
    } catch (err: any) {
      // dummy fallback process (for stage 2)
      if (err.status === 429) {
        console.log(`Rate limit reached !. Switching key...`);
        const check = await fallback(keys);

        if (check) {
          key = check;
          loopTimes++;
          continue; // restarting the loop
        }
      }

      console.error("Error processing update:", err);
      break;
    }
  }

  return c.text("Ok");
};

export default botService;
