import { createAgent, modelFallbackMiddleware } from 'langchain'
import { z } from 'zod'
import { logger } from './logger'

// 1. Standalone Question Agent
const agent_stand_alone_fallback = modelFallbackMiddleware(
  'mistral:mistral-large-latest',
  'together:openai/gpt-oss-120b',
  'google-genai:gemma-3-27b-it',
)

// 1. The Schema
const responseSchema = z.object({
  has_question: z
    .boolean()
    .describe(
      'True if the user input contains a legal scenario/question. False if it is general conversation.',
    ),
  message: z
    .string()
    .describe(
      "Always pass the user's exact original message here, regardless of has_question.",
    ),
  stand_alone_questions_array: z
    .array(z.string())
    .describe(
      'If has_question is true, an array of questions. If false, must be an empty array [].',
    ),
})

// 2. The Strict System Prompt (Improved with Clarity & History Deduplication)
const SYSTEM_PROMPT = `أنت محلل استفسارات قانونية متخصص في قوانين السودان. مهمتك الوحيدة: تصنيف وتحليل رسائل المستخدم.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ التصنيف: هل الرسالة تحتوي على استفسار قانوني أم محادثة عامة؟
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 قاعدة حاسمة:
- "تحية فقط" (السلام عليكم، شكراً، كيف حالك) → has_question: false
- "تحية + سيناريو قانوني" (السلام عليكم... لدي سؤال حول الإيجار) → has_question: true
- المعيار: إذا كانت الرسالة تحتوي على أي سيناريو أو سؤال قانوني بعد التحية → has_question: true
- في حالة عدم التأكد: اختر has_question: true (دع خط الأنابيب التالي يتعامل معه)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2️⃣ المحادثة العامة (has_question: false)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- انسخ نص المستخدم الأصلي في حقل \`message\`
- عيّن \`stand_alone_questions_array\` إلى مصفوفة فارغة []

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3️⃣ الأسئلة القانونية (has_question: true)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- انسخ نص المستخدم الأصلي في حقل \`message\`
- اكسر السيناريو القانوني إلى 1-5 أسئلة قانونية مستقلة وواضحة

📋 قواعد استخراج الأسئلة المستقلة:

1. حل جميع الضمائر (أنا، هو، هي، نحن، أنتن) باستخدام سجل المحادثة
   مثال: "زوجي طردني" → "هل يحق للزوج طرد زوجته من المسكن الزوجي؟"

2. أعد صياغة السيناريو إلى أسئلة واضحة بطريقة الفصحى (العربية الفصحى):
   - فلوس → أموال
   - ازيد → زيادة
   - قعد → جلس/استقر

3. لا تكرر أسئلة من جلسات سابقة:
   - افحص سجل المحادثة
   - إذا سُئل سؤال مشابه سابقاً، اعتبره [تمت الإجابة عليه] أو ركز على جوانب جديدة

4. استخرج الحد الأقصى من 3 إلى 5 أسئلة متميزة وحقيقية
   - لا تكرار
   - لا تجب على الأسئلة — فقط استخرجها وأعد صياغتها
   - رتبها حسب الأهمية (السؤال الأساسي أولاً)

5. كل سؤال يجب أن يكون مفهوماً بمفرده (بدون الحاجة للسياق الأصلي)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ قاعدة مكافحة الحلقات والتنبيهات
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- استخرج أسئلة متمايزة فقط (لا تكرار)
- لا تحاول الإجابة — فقط استخلص الأسئلة
- لا تستنتج أشياء غير مطلوبة ("ربما تريد أيضاً أن تسأل...")
- الأولوية للمشكلة الرئيسية أولاً، ثم التفاصيل الثانوية
`


export const agent_stand_alone = createAgent({
  model: 'google-genai:gemini-2.5-flash',
  middleware: [agent_stand_alone_fallback],
  responseFormat: responseSchema,
  systemPrompt: SYSTEM_PROMPT,
})
// 3. The Reusable Function
export async function analyzeUserMessage(
  userInput: string,
  history: string = '',
) {
  try {
    const inputPayload = `
      CHAT HISTORY:
      ${history}

      CURRENT USER MESSAGE:
      ${userInput}
    `
    const response = await agent_stand_alone.invoke({ messages: inputPayload })
    return response.structuredResponse
  } catch (error) {
    logger.error(`Failed to process message: ${error}`)
    throw error
  }
}

// Test it out!
// const test = await analyzeUserMessage('hi there tell me about you')

// const test = await analyzeUserMessage(`
//  انا مؤجر بيت لي تمانية شهور والعقد مدته سنة وسيد البيت قال  ازيد الايجار او طلع بقدر يطردني قبل القعد ينتهى؟`)

// console.log(test.has_question ? test.stand_alone_questions_array : test.message)

// [ "هل يستطيع سيد البيت طرد المستأجر قبل انتهاء مدة عقد الإيجار المتفق عليها لسنة واحدة؟",
//   "هل يحق لسيد البيت طلب زيادة الإيجار من المستأجر خلال فترة سريان عقد الإيجار الذي مدته سنة؟"
// ]
