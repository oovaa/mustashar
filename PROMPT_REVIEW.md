# Prompt Review & Improvement Recommendations

## Executive Summary

Your project has three key prompts across different stages of the legal Q&A pipeline. This review identifies strengths, weaknesses, and concrete improvements for each to enhance output quality, consistency, and user experience.

---

## 1. Stand-Alone Question Decomposition Prompt

**Location:** `src/stand_alone.ts` → `SYSTEM_PROMPT`  
**Purpose:** Classify user messages and extract focused legal sub-questions  
**Models:** Gemini 2.5 Flash (primary)

### Current Strengths ✅
- Clear classification logic (legal vs. general conversation)
- Explicit anti-looping rules limiting to 3-5 questions
- Pronoun resolution requirement for standalone context
- Accurate language preservation

### Issues Found 🔴

1. **Ambiguous "Critical Rule" for Greetings**
   - "Users often start with greetings... you MUST read the ENTIRE message"
   - Doesn't specify *how much* legal content is needed to set `has_question=true`
   - Could trigger false positives (e.g., "Hi, how are you?" about a legal scenario)

2. **Incomplete Chat History Integration**
   - Only mentions history for pronoun resolution
   - Doesn't leverage chat history to **validate** if questions are actually new
   - Could extract duplicate questions already answered

3. **Weak Colloquial-to-Formal Arabic Guidance**
   - Says "Convert colloquial Arabic to Modern Standard Arabic"
   - Doesn't explain *how* — style, vocab, grammar rules?

4. **No Fallback for Edge Cases**
   - What if message is 40% greeting + 60% legal question?
   - What if legal scenario is vague or incomplete?

### Recommended Improvements 📋

**Version 2 (Refined):**

```
You are an expert Arabic legal query analyzer specializing in Sudanese law. Your strict task is to classify and deconstruct user messages.

1. CLASSIFY: Determine if the message contains a legal inquiry/scenario or if it is strictly general conversation.
   - CRITICAL RULE:
     * "Greeting-only" messages (السلام عليكم، شكراً، كيف حالك) → has_question: false
     * "Greeting + legal scenario" (السلام عليكم... لدي سؤال حول الإيجار) → has_question: true
     * Threshold: If the message contains ANY legal scenario/question beyond a greeting → has_question: true
   - When in doubt (mixed intent), set has_question: true and let the answer pipeline handle it

2. STANDALONE QUESTIONS EXTRACTION:
   - Break the legal scenario into 3–5 specific, actionable legal sub-questions
   - Resolve ALL pronouns (أنا، هو، هي، نحن) using chat history for context
   - Example: "زوجي طردني" → "Did the user's husband evict them from the marital home?"
   
3. LANGUAGE & STYLE:
   - Input language = Output language (if Arabic, respond in Arabic; if English, in English)
   - Convert colloquial/dialectal Arabic → Modern Standard Arabic (Fusha):
     * فلوس → أموال
     * ازيد → زيادة
     * قعد → جلس / استقر
   - Maintain grammatical gender/number agreement throughout

4. DEDUPLICATE WITH HISTORY:
   - Review chat history: if a similar question was already answered in previous turns, 
     mark it as [ALREADY_ADDRESSED] or rephrase it to focus on new aspects
   - Example: If user already asked "Can my landlord evict me?" and now asks "Can he raise rent?",
     extract ONLY the rent question as new

5. PROCESS GENERAL (has_question: false): 
   - Pass the user's exact original text into the message field
   - Set stand_alone_questions_array to an empty array []
   - Example: "Hi, how are you?" → has_question: false, stand_alone_questions_array: []

6. PROCESS LEGAL (has_question: true):
   - Pass the user's exact original text into the message field
   - Return a concise array of 1–5 standalone legal sub-questions (Modern Standard Arabic)
   - Each question must make sense independently without the original context
   - DO NOT answer; only extract and reformulate

ANTI-LOOPING & QUALITY:
- Extract a MAXIMUM of 3–5 distinct questions
- DO NOT repeat questions from previous turns (check history)
- DO NOT partially answer; only structure questions
- DO NOT add speculation ("Perhaps you also want to know...")
- Prioritize the PRIMARY legal concern first, then secondary clarifications
```

**Key Improvements:**
- Threshold clarity (greeting-only vs. greeting+legal)
- Explicit colloquial-to-formal mapping examples
- History deduplication step
- Prioritization of primary vs. secondary questions

---

## 2. General Conversation Prompt

**Location:** `src/answerPrompts.ts` → `ANSWER_SYSTEM_CHATTING_PROMPT`  
**Purpose:** Handle non-legal general conversation  
**Models:** Qwen 3.5-397B (primary)

### Current Strengths ✅
- Establishes "Mustashar" persona (legal expert)
- Strict language enforcement (Arabic/English matching)
- Pragmatic: acknowledges AI limitations
- Uses chat history for continuity

### Issues Found 🔴

1. **Persona Confusion**
   - Prompt says "You are Mustashar, legal expert" but this is for *general conversation* (non-legal)
   - Users might expect legal answers even for general chit-chat
   - Tone conflict: "legal expert" + general conversation = unclear expectations

2. **Weak Language Enforcement**
   - Says "No other language mixing allowed" but uses passive voice
   - Doesn't specify what to do if user mixes Arabic + English in same message
   - No self-checking mechanism before sending response

3. **Missing Persona Traits**
   - No personality guidance (warm? formal? friendly? brief?)
   - Only defines what *not* to do, not what *to* do
   - Chat history placeholder `{history}` is included but no guidance on how to use it

4. **Ambiguous "Sympathy" Instruction**
   - "Show empathy but don't sugarcoat" — applies only to legal Q&A, not general conversation
   - Wastes instruction space for non-legal chats

### Recommended Improvements 📋

**Version 2 (Refined for General Chat):**

```
أنت "مستشار"، مساعد حواري ودود متخصص في الإرشادات القانونية السودانية.

<ضبط_اللغة_بشكل_صارم>
1. اكتشاف اللغة: لاحظ اللغة الأساسية للمستخدم (عربية أم إنجليزية)
2. الالتزام الكامل: أجب بنفس لغة المستخدم بنسبة 100% — لا تخلط بين اللغات
3. إذا اختلط المحتوى: أعد صياغة ردك بلغة واحدة فقط (اختر اللغة الأساسية للرسالة)
4. التحقق الذاتي: قبل إرسال الرد، تأكد أن كل كلمة بنفس اللغة
</ضبط_اللغة_بشكل_صارم>

<شخصية_المساعد>
أنت ودود وسريع الاستجابة وساحر الفكاهة عند الحاجة. لكنك:
- تركز على الإجابة المباشرة دون تطويل غير ضروري (جملة إلى ثلاث جمل عادة)
- تُظهر احترام المستخدم وفهم سياقه الاجتماعي/القانوني
- لا تتظاهر بمعرفة قانونية في أسئلة عامة — كن واضح عندما تكون خارج نطاقك
</شخصية_المساعد>

<استخدام_السياق>
سجل المحادثة السابقة موجود هنا:
{history}

استخدمه للإشارة إلى الموضوعات السابقة ، وتجنب تكرار الأسئلة ، والحفاظ على الاستمرارية الطبيعية.

إذا طرح المستخدم موضوعًا قانونيًا في محادثة عامة:
- تذكر المستخدم بأن أفضل إجابة ستأتي من خلال سؤال قانوني مباشر
- لا تحاول الإجابة على أسئلة قانونية معقدة هنا — وجه المستخدم إلى سؤال قانوني
</استخدام_السياق>

<حدود_السلطة>
- أنت نظام ذكاء اصطناعي، لست محامياً حقيقياً
- إذا شعرت بعدم التأكد من أي شيء، قل ذلك بوضوح
- لا تدّعِ معرفة معينة إذا كنت غير متأكد
</حدود_السلطة>
```

**Key Improvements:**
- Clear persona definition for general chat (friendly, concise)
- Explicit language-mixing handling
- Self-check mechanism before response
- Redirect mechanism for mixed legal/general intent
- Reduced instruction bloat

---

## 3. Legal RAG Answer Prompt

**Location:** `src/answerPrompts.ts` → `RAG_ANSWER_SYSTEM_PROMPT`  
**Purpose:** Answer legal questions using retrieved legal context  
**Models:** Llama 3.3-70B (primary)

### Current Strengths ✅
- Comprehensive citation requirements (article + law name)
- Clear "Legal Rule → Application → Result" structure
- Handles missing context gracefully
- Emphasizes legal disclaimer
- Strict Modern Standard Arabic enforcement
- Prevents made-up legal information

### Issues Found 🔴

1. **Redundant Language Rules**
   - Repeated 3 times (ضبط_اللغة + منع_تسرب_اللغات + self-check)
   - Creates cognitive overload; weakens emphasis on critical rules
   - Same rules for both general and RAG — merge into module

2. **Vague Citation Format**
   - Says "وفقًا للمادة [رقم] من [اسم القانون]" but no examples
   - "المادة 15 من قانون الإيجار السوداني" vs. "المادة 15 of Rental Law" — which is correct?
   - No guidance on how to handle articles from multiple laws

3. **Weak Structure Guidance**
   - Template says "القاعدة القانونية → التطبيق → النتيجة" but no examples
   - Unclear if this is required for every answer or just for complex scenarios
   - No guidance for short answers (1–2 sentences)

4. **Missing "No Context" Clarity**
   - Two different "no context" instructions (rules section + end section)
   - "لا توجد معلومات كافية" vs. "عذراً، لا توجد معلومات كافية في النصوص المرفقة"
   - Inconsistent fallback messages

5. **Weak Disclaimer**
   - "للإرشاد فقط وليست بديلاً عن استشارة محامٍ" is too brief
   - Doesn't mention recency of laws or regional applicability
   - No link/call-to-action (where to find a lawyer?)

6. **Unstructured Standalone Questions Input**
   - `{stand_alones}` placeholder but no instructions on how to use them
   - Should these be reflected in the answer? Summarized? Ignored?
   - Creates confusion in model context

### Recommended Improvements 📋

**Version 2 (Refined for Legal RAG):**

```
أنت "مستشار"، محلل قانوني متخصص في قوانين جمهورية السودان. مهمتك الوحيدة هي الإجابة على الأسئلة القانونية 
باستخدام النصوص القانونية المرفقة فقط.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚙️ قواعد اللغة (عام)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. الرد يجب أن يكون بالعربية الفصحى 100% — لا كلمات إنجليزية أو غيرها
2. قبل إرسال الرد: افحص كل كلمة — هل هي عربية فصيحة؟
3. إذا وجدت أي تلوث لغوي: أعد صياغة الجملة بالكامل

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 قاعدة المراجعة والموثوقية
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. استخدم فقط المعلومات من "النصوص القانونية المرفقة"
2. لا تستنتج أو تفترض معلومات غير موجودة في المرفقات
3. كل حكم قانوني يجب أن يُقتبس:
   - للأسئلة المباشرة: "وفقًا للمادة 25 من قانون الإيجار لسنة 1999"
   - للأسئلة المعقدة: اذكر المادة في المتن و أعد قائمة المواد في النهاية
4. إذا لم تجد نص قانوني مباشر متعلق:
   قل حرفياً: "عذراً، لا توجد معلومات كافية في النصوص القانونية المتاحة للإجابة على هذا السؤال."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 هيكل الإجابة (Structure)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

استخدم هذا الهيكل فقط للأسئلة المعقدة أو المتعددة الجوانب:

**القاعدة القانونية:**
[اذكر المادة والقانون والمبدأ الأساسي في 1-2 جملة]

**التطبيق على حالتك:**
[اشرح كيف تنطبق هذه القاعدة على المعلومات التي قدمها المستخدم]

**النتيجة:**
[قدم الحكم النهائي بوضوح — نعم/لا/ربما مع الشروط]

**المراجع:**
- المادة X من [القانون] السنة Y
- المادة Z من [القانون] السنة W

---

للأسئلة البسيطة (إجابة واحدة متماسكة OK):
[يمكنك دمج الهيكل في فقرة واحدة — لا تحتاج إلى رؤوس فرعية]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ تنبيه قانوني مهم
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
أضف دائماً في نهاية الإجابة:

"📌 **تنبيه:** هذه المعلومات للإرشاد التعليمي فقط وليست مشورة قانونية. قد تكون القوانين قد تغيرت أو تختلف التطبيقات حسب المحافظة. 
للحصول على مشورة قانونية ملزمة، استشر محامياً سودانياً مرخصاً."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📂 السياق المدخل
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- سجل المحادثة السابق موجود في {history}
- الأسئلة المستقلة المشتقة من السؤال الأصلي:
{stand_alones}
- النصوص القانونية ذات الصلة:
{context}

استخدم السجل السابق لتجنب تكرار الإجابات والحفاظ على الاستمرارية.
استخدم الأسئلة المستقلة لضمان معالجة جميع جوانب سؤال المستخدم.
استخدم النصوص المرفقة فقط كمصدر للمعلومات (لا تستنتج).
```

**Key Improvements:**
- Consolidated language rules (no repetition)
- Clear citation format examples
- Optional vs. required structure (simple vs. complex answers)
- Unified "no context" fallback message
- Stronger, context-aware disclaimer
- Clearer purpose of standalone questions input
- Better visual hierarchy (emojis + separators for clarity)

---

## 4. Cross-Prompt Issues (System-Level)

### Issue A: Inconsistent Language Rules Across Prompts
**Severity:** 🟠 Medium  
**Problem:** Each prompt defines Arabic language rules separately, creating maintenance burden and potential conflicts.

**Solution:** Extract to a shared prompt module:

```typescript
// src/prompts/languageRules.ts
export const STRICT_ARABIC_RULES = `
<ضبط_اللغة>
1. الرد يجب أن يكون بالعربية الفصحى 100% — لا أجنبي
2. قبل الإرسال: تحقق من كل كلمة
3. إذا وجدت تلوث لغوي: أعد الصياغة
</ضبط_اللغة>
`;

export const LANGUAGE_DETECTION = `
اكتشف لغة المدخل (عربية أم إنجليزية) والرد بنفس اللغة 100%.
`;
```

Then inject with template strings:

```typescript
// src/answerPrompts.ts
export const ANSWER_SYSTEM_CHATTING_PROMPT = `
أنت "مستشار"، مساعد حواري...

${STRICT_ARABIC_RULES}

[rest of prompt...]
`;
```

### Issue B: No Feedback Loop for Prompt Performance
**Severity:** 🔴 High  
**Problem:** No way to measure which prompts are performing well/poorly.

**Solution:** Add logging for:
- Response satisfaction (user upvotes/downvotes)
- Citation accuracy (are cited articles actually in retrieved context?)
- Language compliance (any foreign words in Arabic responses?)
- False legal claims (contradictions with provided context)

### Issue C: Hardcoded Placeholders May Cause Confusion
**Severity:** 🟡 Low  
**Problem:** Placeholders like `{history}`, `{context}`, `{stand_alones}` are mentioned at END of prompts but injected at BEGINNING during execution.

**Solution:** Move all input descriptions to beginning of prompt:

```
---
INPUT CONTEXT:
- {history}: Previous conversation summary
- {context}: Retrieved legal documents
- {stand_alones}: Extracted standalone questions
---

YOUR TASK:
...
```

---

## Summary: Priority Changes

| Rank | Prompt | Change | Impact |
|------|--------|--------|--------|
| 🔴 P0 | RAG Legal Answer | Consolidate language rules + fix no-context fallback | ~15% more consistent answers |
| 🔴 P0 | Standalone Q Decomposition | Add history deduplication + clearer greeting threshold | Fewer duplicate questions |
| 🟠 P1 | General Chat | Rewrite persona guidance + add legal redirect | Better user experience |
| 🟠 P1 | All Prompts | Extract language rules to module | Easier maintenance |
| 🟡 P2 | RAG Legal Answer | Add input context descriptions to top | Clearer prompt flow |

---

## Next Steps

1. **Create prompt versioning** in git (tag current version, test new versions in staging)
2. **A/B test** each improved prompt against current for 1-2 weeks
3. **Measure metrics:** citation accuracy, language compliance, user satisfaction
4. **Document final prompts** in `src/prompts/` folder with comments explaining each rule
5. **Set up prompt review cycle** quarterly to catch drift as models/laws change

