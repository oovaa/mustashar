import { getLLM } from '../llm'
import { retriver } from './retriver'
import { ChatPromptTemplate } from '@langchain/core/prompts'

const llm = getLLM('', 'llama-3.3-70b-versatile', 0.5)

export async function answer(question: string, summary?: string) {
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
    3. Keep the query in the same language as the user's input.
    4. Return ONLY the string.
    `,
    ],
    ['human', `SUMMARY: {summary} \n QUESTION: {question}`],
  ])

  const standaloneChain = standalonePrompt.pipe(llm)

  const stand_alone = await standaloneChain.invoke({
    question: question,
    summary: summary,
  })

  console.log('Generated Search Query:', stand_alone.content)

  // --- Step 2: Retrieve Context ---
  const chunks = await retriver.invoke(stand_alone.content as string)

  // (Optional) formatting chunks to string if your retriever returns objects
  const contextString = JSON.stringify(chunks.map((x) => x.pageContent))

  // --- Step 3: Generate Answer ---
  // We give strict "Grounding" instructions to prevent hallucination.
  const answerPrompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `أنت مساعد قانوني متخصص في القوانين السودانية فقط.

    قواعد صارمة يجب الالتزام بها:
    - استخدم حصراً النصوص القانونية السودانية المقدمة لك في السياق.
    - لا تعتمد على أي قانون أو نظام قانوني غير سوداني.
    - لا تفترض أو تخمّن مواد قانونية غير موجودة في النص.
    - إذا لم يتوفر في السياق نص قانوني واضح يجيب على السؤال، قل بوضوح: "لا توجد مادة قانونية صريحة في النص المتاح تجيب على هذا السؤال".
    - عند ذكر حكم قانوني، حاول ذكر رقم المادة أو الفصل إن وجد.
    - استخدم لغة عربية رسمية واضحة.
    - لا تقدم نصيحة قانونية شخصية، بل شرحاً قانونياً للنص فقط.

    مهمتك:
    شرح النص القانوني السوداني المتعلق بالسؤال، كما ورد في السياق، بطريقة واضحة ومنظمة.
    Context:
    {context}`,
    ],
    [
      'human',
      `Conversation History: {summary}
      User Question: {question}
    
    Refined Search Query Used: {stand_alone_question}`,
    ],
  ])

  const answerChain = answerPrompt.pipe(llm)

  const result = await answerChain.invoke({
    question: question,
    context: contextString,
    stand_alone_question: stand_alone.content,
    summary: summary,
  })

  console.log(result.content)

  return result
}

// // Test
// const ans = await answer(
//   `مؤجرين وقبل مانتم سنة في البيت صاحب البيت بلغنا قبل شهر انو من الشهر الجاي مطالبين ب زيادة وانا بلغتو برفضي للزيادة الا بعد نكمل سنه في البيت
// مع العلم اننا صلحنا الحوش مع الجيران كان في أماكن فاتحه ..
// ونحن بنينا لينا زيادة مباني
// ونحن كلمناه من البداية عايزين ايجار طويل المدى
// عشان كدا خسرنا فيهو وزدنا فيهو
// الكلام ده كلو شفهي بدون عقد ايجار
// ارجو الافادة`,
// )

// console.log(ans.content)
