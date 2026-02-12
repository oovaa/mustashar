import { ChatGroq } from '@langchain/groq'
import { getLLM } from '../llm'
import { retriver } from './retriver'
import { ChatPromptTemplate } from '@langchain/core/prompts'

const llm = getLLM()

async function answer(question: string) {
  // --- Step 1: Generate Standalone Question ---
  // We use a structured prompt to ensure the LLM extracts the core legal intent.
  const standalonePrompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `You are an expert legal search assistant. 
    Analyze the user's input, which may be a long narrative or specific scenario.
    Your task is to formulate a standalone search query that captures the core legal questions.
    
    Rules:
    1. Remove specific personal details (names, exact dates, specific amounts).
    2. Focus on the legal concepts (e.g., "Alimony appeal effects", "Obedience judgment consequences").
    3. Keep the query in the same language as the user's input.`,
    ],
    ['human', '{question}'],
  ])

  const standaloneChain = standalonePrompt.pipe(llm)

  const stand_alone = await standaloneChain.invoke({
    question: question,
  })

  console.log('Generated Search Query:', stand_alone.content)

  // --- Step 2: Retrieve Context ---
  const chunks = await retriver.invoke(stand_alone.content as string)

  // (Optional) formatting chunks to string if your retriever returns objects
  const contextString = JSON.stringify(chunks)

  // --- Step 3: Generate Answer ---
  // We give strict "Grounding" instructions to prevent hallucination.
  const answerPrompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `You are a helpful and precise legal assistant.
    Answer the user's question based STRICTLY on the provided context below.
    
    Instructions:
    1. Respond in the same language as the user (Arabic).
    2. Do not use outside knowledge. If the answer is not in the context, say: "I cannot find the answer in the provided documents."
    3. Cite your sources by referring to the specific context chunks used.
    4. Be empathetic but professional.
    
    Context:
    {context}`,
    ],
    [
      'human',
      `User Question: {question}
    
    Refined Search Query Used: {stand_alone_question}`,
    ],
  ])

  const answerChain = answerPrompt.pipe(llm)

  const result = await answerChain.invoke({
    question: question,
    context: contextString,
    stand_alone_question: stand_alone.content,
  })

  console.log(result.content)

  return result
}

// Test
answer(
  'السلام عليكم .. بسأل انا رفعت دعوه نفقه زوجيه وبنوه ، الحكم طلع لصالحي، زوجي عمل استئناف وقبل يطلع حكم الاستئناف أجر شقه ورفع دعوى طاعة ، حاليا حكم الاستئناف طلع ولغى الحكم الأول ، علما بأنو نحن لينا عشره شهور، منها  خمسه شهور فقط ادانا نفقه مؤقته كان حكم بيها القاضي 150الف شهريا فقط وعندي بنتين ، بسأل لو حكمو ليهو بالطاعه كده ح ارجع وحقوقنا تضيع ولا الحل شنو؟',
)
