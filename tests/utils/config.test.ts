import { describe, it, expect } from 'bun:test'
import { validateEnvironment } from '../../src/utils/config'

describe('Config validation', () => {
  it('should throw error for missing environment variables', () => {
    const originalEnv = process.env
    process.env = { ...originalEnv, BOT_TOKEN: undefined }
    
    expect(() => validateEnvironment()).toThrow('Missing required environment variables')
    
    process.env = originalEnv
  })
})
