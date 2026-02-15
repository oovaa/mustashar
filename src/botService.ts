import { Request, Response } from 'express'
import { getLLM } from './llm'
import postgres from 'postgres' // 1. Use postgres.js
import { HumanMessage, SystemMessage } from 'langchain'
import { answer } from './rag/chain'

const sql = postgres(process.env.DATABASE_URL!, { ssl: false })

const botService = async (req: Request, res: Response) => {
  try {
    const key: string = process.env.GROQ_API_KEY!
    const update = req.body
    const chat_id = update.message?.chat.id.toString()
    const userText = update.message?.text

    if (!chat_id || !userText) {
      res.send('Ok')
      return
    }

    await sql`
    CREATE TABLE IF NOT EXISTS user_memories (
      chat_id TEXT PRIMARY KEY,
      summary TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    )`

    console.log('Table check/creation complete.')

    try {
      const summarizerLLM = getLLM(
        key,
        'llama-3.1-8b-instant',
        0,
        'openai/gpt-oss-20b',
      )

      // 2. Getting the stored summary
      const result = await sql`
          SELECT summary FROM user_memories WHERE chat_id = ${chat_id}
        `
      const oldSummary = result[0]?.summary || 'No history found'
      console.log('User Question:', userText)
      console.log('Old Summary:', oldSummary)

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
      ])

      console.log(
        'Summarization Model Used:',
        updatedSummary.response_metadata?.model_name,
      )
      console.log('Updated Summary:', String(updatedSummary.content))

      await sql`
          INSERT INTO user_memories (chat_id, summary) 
          VALUES (${chat_id}, ${String(updatedSummary.content)})
          ON CONFLICT (chat_id) DO UPDATE SET summary = ${String(updatedSummary.content)}
        `

      // 4. Calling the chain
      const finalAnswer = await answer(
        userText,
        updatedSummary.content as string,
      )

      // 5. Telegram fetch
      await fetch(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id, text: finalAnswer.content }),
        },
      )
      res.send({ answer: finalAnswer.content })
    } catch (err: any) {
      console.error('Error processing update:', err)
      
      // Check if it's a rate limit error
      const MAX_ERROR_MESSAGE_LENGTH = 1000
      const errorMsg = err?.message || ''
      const errorMessageLower = errorMsg.length <= MAX_ERROR_MESSAGE_LENGTH 
        ? errorMsg.toLowerCase() 
        : errorMsg.substring(0, MAX_ERROR_MESSAGE_LENGTH).toLowerCase()
      
      const isRateLimit = errorMessageLower.includes('rate limit') ||
                         errorMessageLower.includes('rate_limit') ||
                         err?.status === 429 ||
                         err?.statusCode === 429 ||
                         err?.code === 'rate_limit_exceeded'
      
      const errorMessage = isRateLimit
        ? 'عذراً، لقد وصلنا إلى الحد الأقصى لعدد الطلبات. يرجى المحاولة مرة أخرى بعد قليل.'
        : 'حدث خطأ أثناء معالجة الاستعلام. يرجى المحاولة مرة أخرى.'
      
      // Send error message to Telegram (chat_id is guaranteed to be defined here)
      try {
        await fetch(
          `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id, text: errorMessage }),
          },
        )
      } catch (fetchError) {
        console.error('Failed to send error message to Telegram:', fetchError)
      }
      
      res.json({ error: errorMessage })
    }
  } catch (error) {
    console.log(error)
    res.json({ error: 'حدث خطأ داخلي في الخادم.' })
  }
}

export default botService
