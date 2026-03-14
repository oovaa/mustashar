import { Request, Response } from "express";
import { sql } from "./index";

export const usersCount = async (_: any, res: Response) => {
  try {
    const result = await sql`SELECT COUNT(*) FROM user_memories`;
    return res.send({ count: result[0].count });
  } catch (err) {
    console.error("faild to count users", err);
    throw err;
  }
};

export const messagesCount = async (_: any, res: Response) => {
  try {
    const result =
      await sql`SELECT SUM(messages_count) as total FROM user_memories`;
    return res.send({ count: result[0]?.total });
  } catch (err) {
    console.error("faild to count messages", err);
    throw err;
  }
};

export const messagesByDate = async (req: Request, res: Response) => {
  try {
    const { date } = req.params; // 2026-1-1, 2026-3-5, ...etc

    const result =
      await sql`SELECT SUM(messages_count) as total FROM user_memories WHERE updated_at::date = ${date}`;
    return res.json({ count: result[0]?.total || 0 });
  } catch (err) {
    console.error("faild to count messages", err);
    throw err;
  }
};
