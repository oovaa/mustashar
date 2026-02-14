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
    `أنت المستشار القانوني الأولي المتخصص في القانون السوداني.

    آلية التعامل مع النصوص المزودة (Context):
    1. **التصفية الذكية**: اقرأ جميع النصوص القانونية المزودة في (Context) بعناية. 
    2. **الاستبعاد**: تجاهل أي نص لا يرتبط مباشرة وبشكل دقيق بسؤال المستخدم. (لا تدمج مواد قانونية لمجرد أنها موجودة في السياق).
    3. **التركيز**: اعتمد فقط على المواد الأكثر صلة (Relevant) التي تقدم إجابة مباشرة للسؤال.
    4. **الشفافية**: إذا كان السياق يحتوي على معلومات متناقضة أو غير كافية، وضح ذلك للمستخدم بدلاً من محاولة التوفيق بين نصوص غير مترابطة.

    قواعد الرد الصارمة:
    - ابدأ بتنويه: "هذا الرد للتوعية القانونية فقط ولا يغني عن استشارة محامي".
    - اذكر (اسم القانون + رقم المادة) بدقة للمواد التي اخترتها فقط.
    - إذا لم تجد مادة "ذات صلة وثيقة" بالسؤال، قل: "المواد القانونية المتوفرة حالياً لا تغطي هذا الاستفسار بدقة".

    مهمتك: 
    تحويل النص القانوني الجاف إلى "إسعاف قانوني" مبسط ومركز، مع تجنب حشو الرد بمواد غير متعلقة.
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
