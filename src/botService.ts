import { Request, Response } from "express";
import { getLLM } from "./llm";
import postgres from "postgres"; // 1. Use postgres.js
import { HumanMessage, SystemMessage } from "langchain";
import { answer } from "./rag/chain";

const sql = postgres(process.env.DATABASE_URL!, { ssl: false });

const botService = async (req: Request, res: Response) => {
  try {
    const key: string = process.env.GROQ_API_KEY!;
    const update = req.body;
    const chat_id = update.message?.chat.id.toString();
    const userText = update.message?.text;

    if (!chat_id || !userText) {
      res.send("Ok");
      return;
    }
    if (chat_id && userText === "/clear") {
      try {
        await sql`UPDATE user_memories SET summary = 'No history found', updated_at = NOW() WHERE chat_id = ${chat_id}`;
        await fetch(
          `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id,
              text: "تم مسح الذاكرة بنجاح، سأبدأ الآن معك صفحة جديدة ✅",
            }),
          },
        );
        return;
      } catch (err) {
        console.error("could not be able to clear the chat :", err);
        throw err;
      }
    }

    await sql`
    CREATE TABLE IF NOT EXISTS user_memories (
      chat_id TEXT PRIMARY KEY,
      summary TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    )`;

    console.log("Table check/creation complete.");

    try {
      const summarizerLLM = getLLM(
        key,
        "llama-3.1-8b-instant",
        0,
        "openai/gpt-oss-20b",
      );

      // 2. Getting the stored summary
      const result = await sql`
          SELECT summary FROM user_memories WHERE chat_id = ${chat_id}
        `;
      const oldSummary = result[0]?.summary || "No history found";

      // 3. Updating summary
      const updatedSummary = await summarizerLLM.invoke([
        new SystemMessage(`You are a memory compressor for a legal chatbot. Your task is to maintain a concise summary of the user's conversation history.

Instructions:
- Keep the summary under 800 characters
- Focus on key legal topics discussed
- Include important facts or questions
- Update the summary with new information from the current message
- If this is the first message, create a new summary

Output only the updated summary, no additional text.`),
        new HumanMessage(
          `Current summary: ${oldSummary}. new message: ${userText}`,
        ),
      ]);

      console.log(
        "Summarization Model Used:",
        updatedSummary.response_metadata?.model_name,
      );

      await sql`
          INSERT INTO user_memories (chat_id, summary) 
          VALUES (${chat_id}, ${String(updatedSummary.content)})
          ON CONFLICT (chat_id) DO UPDATE SET summary = ${String(
            updatedSummary.content,
          )}
        `;

      console.log("Updated Summary Content:", updatedSummary.content);

      // 4. Calling the chain
      const finalAnswer = await answer(
        userText,
        String(updatedSummary.content),
      );

      // 5. Telegram fetch
      await fetch(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id, text: finalAnswer.content }),
        },
      );
      res.send({ answer: finalAnswer.content });
    } catch (err: any) {
      console.error("Error processing update:", err);
      res.json({
        error: "حدث خطأ أثناء معالجة الاستعلام. يرجى المحاولة مرة أخرى.",
      });
    }
  } catch (error) {
    console.log(error);
    res.json({ error: "حدث خطأ داخلي في الخادم." });
  }
};

export default botService;