import 'dotenv/config'
import { getLLM } from '../llm'
import { retriver } from './retriver'
import { ChatPromptTemplate } from '@langchain/core/prompts'

const llm = getLLM('', 'llama-3.3-70b-versatile', 0.5, 'openai/gpt-oss-120b')

export async function answer(question: string, summary?: string) {
  /* ===============================
     STEP 1: Standalone Search Query
     =============================== */ const standalonePrompt =
    ChatPromptTemplate.fromMessages([
      [
        'system',
        `أنت مساعد قانوني خبير في استخراج كلمات البحث.
    قم بتحليل نص المستخدم، والذي قد يكون قصة طويلة أو موقفاً قانونياً معيناً.
    مهمتك هي صياغة جملة بحث مستقلة (Search Query) تلخص الجوهر القانوني للسؤال للبحث عنها في قاعدة البيانات.
    
    القواعد:
    1. احذف التفاصيل الشخصية (مثل الأسماء، التواريخ، المبالغ الدقيقة).
    2. ركز فقط على المصطلحات والمفاهيم القانونية (مثل: "حضانة الأبناء"، "النفقة الزوجية"، "بيت الطاعة").
    3. اكتب جملة البحث باللغة العربية فقط.
    4. أرجع نص البحث فقط (بدون أي مقدمات أو شرح إضافي).
    5. هام جداً: إذا كان إدخال المستخدم مجرد تحية (مثل "السلام عليكم"، "مرحبا")، أو مجرد حرف/علامة ترقيم (مثل ".")، أو لا يحتوي على أي سؤال قانوني واضح، يجب عليك أن ترجع الكلمة التالية حرفياً فقط وبدون أي إضافات: NO_SEARCH
    `,
      ],
      ['human', `الملخص السابق: {summary} \n سؤال المستخدم: {question}`],
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
    1. **التصفية الذكية**: اقرأ النصوص القانونية في (Context).
    2. **الاستبعاد والتركيز**: تجاهل غير المرتبط وركز على المواد الدقيقة.

    قواعد الرد:
    - إذا كان سؤال المستخدم عاماً أو عبارة عن "تحية"، رد بلباقة وود (مثلاً: أهلاً بك، كيف يمكنني مساعدتك قانونياً اليوم؟).
    - في حالة الرد القانوني: ابدأ بتنويه: "هذا الرد للتوعية القانونية فقط ولا يغني عن استشارة محامي".
    - اذكر (اسم القانون + رقم المادة) بدقة.
    - إذا لم تجد مادة صلة، قل: "المواد القانونية المتوفرة حالياً لا تغطي هذا الاستفسار بدقة".

    مهمتك: 
    تقديم "إسعاف قانوني" مبسط ومركز. إذا كان السؤال خارج النطاق القانوني، كن ودوداً ومرحب. مع تجنب حشو الرد بمواد غير متعلقةاً.

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

  console.log('Answer Model Used:', result.response_metadata.model)
  console.log('FINAL ANSWER:\n', result.content)

  return result
}

// answer('hi there')

// Generated Search Query: لا يوجد سؤال قانوني للتحويل.
// Retrieved Chunks: 8
// FINAL ANSWER:
//  أهلاً بك، كيف يمكنني مساعدتك قانونياً اليوم؟
