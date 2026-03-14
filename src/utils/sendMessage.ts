import { sql, BOT_TOKEN } from "../index";

// this file is just a template for telegram message

export const sendMessage = async (chat_id: string, msg: string) => {
  try {
    await sql`INSERT INTO user_memories (chat_id, messages_count)
    VALUES (${chat_id}, 1)
    ON CONFLICT (chat_id) DO UPDATE SET messages_count = user_memories.messages_count + 1
    `;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id,
        text: msg.trim(),
      }),
    });
    return;
  } catch (err) {
    console.error("faild to handle a message", err);
    throw err;
  }
};
