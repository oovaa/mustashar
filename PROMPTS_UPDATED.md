# Prompt Updates Summary

Date: March 29, 2026  
Status: ✅ Complete

## Files Updated

### 1. `/src/answerPrompts.ts`
**Updated:** General Conversation Prompt + Legal RAG Answer Prompt

#### Changes Made:

**General Chat Prompt (ANSWER_SYSTEM_CHATTING_PROMPT):**
- ✅ Replaced confusing persona (was "legal expert" for non-legal chats)
- ✅ Added clear persona definition (friendly, concise helper)
- ✅ Consolidated language rules (removed repetition)
- ✅ Added explicit language-mixing handling
- ✅ Added self-check mechanism before response
- ✅ Added redirect mechanism for mixed legal/general intent
- ✅ Maintained existing chat history usage

**Legal RAG Answer Prompt (RAG_ANSWER_SYSTEM_PROMPT):**
- ✅ Moved input context descriptions to top (better clarity)
- ✅ Consolidated redundant language rules (previously 3 sections, now 1)
- ✅ Added clear citation format examples
- ✅ Made structure optional vs. required (complex vs. simple answers)
- ✅ Fixed duplicate "no context" fallback messages (unified)
- ✅ Strengthened legal disclaimer with recency & regional applicability notes
- ✅ Clarified purpose of standalone questions input
- ✅ Added better visual hierarchy (emojis + separators)
- ✅ Maintained Arabic language

### 2. `/src/stand_alone.ts`
**Updated:** Stand-Alone Question Decomposition Prompt

#### Changes Made:
- ✅ Fixed ambiguous "Critical Rule" for greeting threshold
  - Clear examples: "Greeting-only" vs. "Greeting + legal scenario"
  - Added fallback: "When in doubt, choose has_question: true"
  
- ✅ Added history deduplication step
  - Check previous conversations for duplicate questions
  - Mark repeated questions as [Already Addressed]
  - Focus on new aspects instead
  
- ✅ Improved colloquial-to-formal Arabic guidance
  - Added specific mapping examples (فلوس → أموال, ازيد → زيادة, قعد → جلس)
  
- ✅ Added robust rule numbering and organization
  - 5 numbered extraction rules
  - Anti-looping safeguards section
  
- ✅ Clarified that questions should be extractable independently
- ✅ Maintained Arabic language throughout

## Key Improvements Across All Prompts

| Aspect | Before | After | Impact |
|--------|--------|-------|--------|
| Language Rules | Repeated 3× per prompt | Consolidated to 1 section | Clearer focus, less cognitive overload |
| Greeting Classification | Ambiguous threshold | Clear threshold + examples | Fewer false positives |
| Citation Format | Vague instructions | Specific examples provided | More consistent citations |
| Answer Structure | Always required | Optional for simple answers | Better flexibility |
| No-Context Message | 2 different fallbacks | 1 unified message | Consistency |
| History Deduplication | Not mentioned | Explicit rule | Fewer duplicate questions |
| Persona Clarity | Legal expert (for all) | Role-specific (chat vs. legal) | Better user experience |

## Testing Recommendations

Before deploying to production, test with:

1. **Greeting Classification:**
   - Input: "السلام عليكم"
   - Expected: `has_question: false`
   
   - Input: "السلام عليكم، لدي مشكلة في الإيجار"
   - Expected: `has_question: true`

2. **Language Enforcement:**
   - Input: English or mixed Arabic/English questions
   - Expected: Pure Arabic responses in Fusha

3. **Citation Accuracy:**
   - Compare answer responses: are cited articles actually in retrieved context?
   - Check for fabricated references

4. **Structure Flexibility:**
   - Simple legal question: Check if responses avoid unnecessary headers
   - Complex multi-aspect question: Check if structured format is used

## Next Steps

1. **Deploy to staging** and monitor for 1-2 weeks
2. **Measure metrics:**
   - Citation accuracy (cited articles match context)
   - Language compliance (zero non-Arabic words in Arabic responses)
   - User satisfaction (upvote/downvote if available)
   - False legal claims (contradictions with provided context)

3. **Document in PROMPT_REVIEW.md:**
   - Which improvements are working best
   - Which need refinement

4. **Set up quarterly prompt review cycle** to catch decay as models/laws change

## Files Changed
- `src/answerPrompts.ts` — 2 prompts improved
- `src/stand_alone.ts` — 1 prompt improved
- `PROMPT_REVIEW.md` — Comprehensive review document created

All changes maintain the Arabic language throughout as requested.
