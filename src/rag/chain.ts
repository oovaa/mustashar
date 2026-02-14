import 'dotenv/config'
import { getLLM } from '../llm'
import { retriver } from './retriver'
import { ChatPromptTemplate } from '@langchain/core/prompts'

const llm = getLLM('', 'llama-3.3-70b-versatile', 0.5)

export async function answer(question: string, summary?: string) {
  /* ===============================
     STEP 1: Standalone Search Query
     =============================== */

  const standalonePrompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `
أنت مساعد بحث قانوني متخصص في القوانين السودانية.

مهمتك:
تحويل سؤال المستخدم (حتى لو كان قصة طويلة أو بلهجة عامية)
إلى عبارة بحث قانونية مختصرة وواضحة.

قواعد:
1. استخرج المفاهيم القانونية الأساسية فقط.
2. احذف التفاصيل الشخصية (أسماء، دول، تواريخ دقيقة).
3. استخدم مصطلحات قانونية عامة (طلاق، نفقة، هجر، حضانة).
4. اكتب الاستعلام باللغة العربية.
5. لا تكتب جملة كاملة، فقط عبارة بحث.
6. ممنوع كتابة عبارات مثل "لا توجد معلومات".

أمثلة صحيحة:
- النفقة على الأولاد في حالة الطلاق
- هجر الزوج وأثره على النفقة
- تقدير نفقة الأطفال في القانون السوداني

أعد فقط عبارة البحث.
      `,
    ],
    [
      'human',
      `
سؤال المستخدم:
{question}
      `,
    ],
  ])

  const standaloneChain = standalonePrompt.pipe(llm)

  const standAloneResult = await standaloneChain.invoke({
    question,
  })

  const standAloneQuery = String(standAloneResult.content).trim()
  console.log('Generated Search Query:', standAloneQuery)

  /* ===============================
     STEP 2: Retrieve Legal Context
     =============================== */

  const chunks = await retriver.invoke(standAloneQuery)

  const contextString =
    chunks && chunks.length > 0
      ? chunks.map((x: any) => x.pageContent).join('\n\n')
      : ''

  console.log('Retrieved Chunks:', chunks?.length ?? 0)

  /* ===============================
     STEP 3: Generate Answer
     =============================== */

 
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
      `
سجل المحادثة السابق:
{summary}

سؤال المستخدم:
{question}

استعلام البحث المستخدم:
{standAloneQuery}
      `,
    ],
  ])

  const answerChain = answerPrompt.pipe(llm)

  const result = await answerChain.invoke({
    question,
    summary: summary ?? '',
    context: contextString,
    standAloneQuery,
  })

  console.log('FINAL ANSWER:\n', result.content)

  return result
}
