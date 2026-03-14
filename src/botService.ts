import { Request, Response } from "express";
import { getLLM } from "./llm";
import { HumanMessage, SystemMessage } from "langchain";
import { answer } from "./rag/chain";
import { handleCommand } from "./commands";
import { sql, GROQ_API_KEY, BOT_TOKEN } from "./index";

const botService = async (req: Request, res: Response) => {
  try {
    const key = GROQ_API_KEY;
    const update = req.body;
    const chat_id = update.message?.chat.id.toString();
    const userText = update.message?.text;

    if (!chat_id || !userText) {
      res.send("Ok");
      return;
    }

    if (chat_id && userText.startsWith("/")) {
      await handleCommand(chat_id, userText);
      return res.send("ok");
    }

    await sql`
    CREATE TABLE IF NOT EXISTS user_memories (
      chat_id TEXT PRIMARY KEY,
      summary TEXT,
      messages_count INT DEFAULT 0,
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
          INSERT INTO user_memories (chat_id, summary, messages_count) 
          VALUES (${chat_id}, ${String(updatedSummary.content)})
          ON CONFLICT (chat_id) DO UPDATE SET summary = ${String(updatedSummary.content,)}, 
          messages_count = user_memories.messages_count + 1,
          updated_at = NOW()
        `;

      console.log("Updated Summary Content:", updatedSummary.content);

      // 4. Calling the chain
      const finalAnswer = await answer(
        userText,
        String(updatedSummary.content),
      );

      // 5. Telegram fetch
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id, text: finalAnswer.content }),
      });
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