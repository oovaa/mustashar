import { Context } from "hono";
import { getLLM } from "./llm";

const botService = async (c: Context) => {
  try {
    const update = await c.req.json();
    const chat_id = update.message?.chat.id;
    const userText = update.message?.text;

    if (chat_id && userText) {
      const llm = getLLM(c.env.GROQ_API_KEY);
      const aiResponse = await llm.invoke(userText);
      const aiAnswer = aiResponse.content;

      await fetch(
        `https://api.telegram.org/bot${c.env.BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chat_id, text: aiAnswer }),
        },
      );
    }
  } catch (err) {
    console.error("Error processing update:", err);
  }

  return c.text("Ok");
};

export default botService;
