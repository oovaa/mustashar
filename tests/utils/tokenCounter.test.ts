import { describe, it, expect } from 'bun:test'
import { estimateTokens, truncateToTokenLimit } from '../../src/utils/tokenCounter'

describe('Token counter', () => {
  it('should estimate tokens for English text', () => {
    const text = 'Hello world' // 11 chars
    const tokens = estimateTokens(text, false)
    expect(tokens).toBe(3) // ceil(11/4) = 3
  })

  it('should estimate tokens for Arabic text', () => {
    const text = 'مرحبا بالعالم' // 14 chars
    const tokens = estimateTokens(text, true)
    expect(tokens).toBe(7) // ceil(14/2) = 7
  })

  it('should truncate text to token limit', () => {
    const text = 'A'.repeat(100)
    const truncated = truncateToTokenLimit(text, 10, false)
    expect(truncated.length).toBeLessThanOrEqual(55) // 10 tokens * 4 chars + 15 chars suffix
    expect(truncated).toContain('... [truncated]')
  })
})
