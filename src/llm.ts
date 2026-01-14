import { ChatGroq } from '@langchain/groq'
import { env } from 'hono/adapter'

export const llm = new ChatGroq({
  model: 'llama-3.3-70b-versatile',
  apiKey: process.env.GROQ_API_KEY,
  temperature: 0,
  maxRetries: 2,
})

const ans = await llm.invoke('hi there tell me about RAG in AI')

console.log(ans.content)
