// Simple token counter using character approximation
// For production, consider using tiktoken for accurate counting

const CHARS_PER_TOKEN = 4 // Approximation for English text
const ARABIC_CHARS_PER_TOKEN = 2 // Arabic text is more token-dense

/** Estimates token count for a string using a simple character approximation. */
export function estimateTokens(text: string, isArabic = false): number {
  const charsPerToken = isArabic ? ARABIC_CHARS_PER_TOKEN : CHARS_PER_TOKEN
  return Math.ceil(text.length / charsPerToken)
}

/** Truncates text to fit within a token budget. Appends '... [truncated]' if cut. */
export function truncateToTokenLimit(
  text: string,
  maxTokens: number,
  isArabic = false,
): string {
  const estimatedTokens = estimateTokens(text, isArabic)

  if (estimatedTokens <= maxTokens) {
    return text
  }

  const charsPerToken = isArabic ? ARABIC_CHARS_PER_TOKEN : CHARS_PER_TOKEN
  const maxChars = maxTokens * charsPerToken
  return text.substring(0, maxChars) + '... [truncated]'
}
