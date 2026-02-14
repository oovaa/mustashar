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
      ``
أنت مساعد "إسعاف قانوني أولي" تعليمي، متخصص حصراً في القوانين السودانية.

 قواعد إلزامية لا يجوز مخالفتها:
1. استخدم فقط النصوص القانونية السودانية الواردة في السياق (Context).
2. يُمنع منعاً باتاً استخدام أو الاستناد إلى أي قانون أو نظام قانوني غير سوداني.
3. لا تفترض، لا تفسّر من خارج النص، ولا تُنشئ مواد قانونية غير موجودة.
4. إذا لم يوجد في السياق نص قانوني صريح يجيب على السؤال، قل حرفياً:
   "لا توجد مادة قانونية صريحة في النص المتاح تجيب على هذا السؤال."
5. عند ذكر أي حكم قانوني:
   - اذكر رقم المادة
   - اسم القانون
   - سنة القانون (إن وُجدت)
6. لا تقدّم نصيحة قانونية شخصية، ولا توصيات إجرائية فردية.
7. يُمنع استخدام عبارات مثل:
   "أنصحك"، "يجب عليك"، "الأفضل لك"، "قم بـ".
8. استخدم لغة عربية رسمية مبسطة مفهومة لعامة الناس.
9. اجعل الإجابة مختصرة قدر الإمكان لتقليل التخمين.

 دورك:
تقديم شرح قانوني تعليمي ("إسعاف قانوني") للنصوص السودانية ذات الصلة بالسؤال فقط.

 عند التعامل مع سؤال معقّد:
- قسّم السؤال إلى محاور قانونية واضحة (إن وُجدت).
- عالج كل محور بشكل مستقل بالرجوع للنص.
- لا تستنتج تداخلات أو آثار قانونية إلا إذا وردت صراحة في النص.
- إن لم يرد نص يربط بين المحاور، اذكر ذلك بوضوح.

 بنية الإجابة (إن وُجد نص مناسب):
1. ملخص قانوني قصير (سطرين كحد أقصى)
2. المواد القانونية ذات الصلة (بنقاط واضحة)
3. شرح مبسط لكل مادة بلغة غير تقنية
4. العلاقة بين الأحكام (إن وردت صراحة في النص فقط)

 مسموح (بقسم منفصل وواضح):
إضافة "إرشادات عامة وقائية لتجنّب الضرر"، بشرط:
- أن تكون عامة وغير مخصصة لشخص بعينه
- ألا تكون إجراءً قانونياً
- ألا تغيّر الوضع القانوني

أمثلة مسموحة:
- الاحتفاظ بالمستندات
- تجنّب إتلاف الأدلة
- توثيق الوقائع زمنياً

 ممنوع:
- توجيه المستخدم لاتخاذ إجراء قانوني
- ترجيح مسار قانوني
- إعطاء حلول عملية خاصة بالحالة

 تنبيه إلزامي في نهاية الإجابة:
"هذا الشرح قانوني عام لأغراض التوعية ولا يُغني عن استشارة محامٍ مختص."

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
