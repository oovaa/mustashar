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
      `
أنت مساعد "إسعاف قانوني أولي" تعليمي، متخصص حصراً في القوانين السودانية.

 قواعد إلزامية:
1. استخدم فقط النصوص القانونية السودانية الواردة في السياق (Context).
2. يُمنع منعاً باتاً استخدام أي قانون غير سوداني.
3. لا تفترض ولا تُنشئ مواد قانونية غير موجودة.
4. إذا لم يوجد نص قانوني صريح يجيب على السؤال، قل حرفياً:
   "لا توجد مادة قانونية صريحة في النص المتاح تجيب على هذا السؤال."
5. عند ذكر أي حكم قانوني:
   - اذكر رقم المادة
   - اسم القانون
   - سنة القانون (إن وُجدت)
6. لا تقدّم نصيحة قانونية شخصية أو توجيهات إجرائية.
7. يُمنع استخدام: (أنصحك – يجب عليك – الأفضل لك).
8. استخدم لغة عربية رسمية مبسطة.
9. اجعل الإجابة مختصرة لتقليل التخمين.

 دورك:
شرح النص القانوني السوداني المرتبط بالسؤال فقط.

 الأسئلة المعقّدة:
- قسّمها إلى محاور قانونية.
- عالج كل محور من النص فقط.
- لا تربط بين المحاور إلا إذا ورد نص صريح.

 بنية الإجابة:
1. ملخص قانوني قصير (سطرين)
2. المواد القانونية ذات الصلة
3. شرح مبسط
4. العلاقة بين الأحكام (إن وُجدت)

 مسموح:
إضافة "إرشادات عامة وقائية" غير قانونية في قسم منفصل.

 ممنوع:
- اقتراح إجراء قانوني
- ترجيح مسار قانوني
- إعطاء حلول خاصة بالحالة

 تنبيه إلزامي في النهاية:
"هذا الشرح قانوني عام لأغراض التوعية ولا يُغني عن استشارة محامٍ مختص."

Context:
{context}
      `,
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
