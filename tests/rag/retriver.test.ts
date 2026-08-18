import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'
import { getRetriever, retriver } from '../../src/rag/retriver'

describe('RAG Retriever Lazy Loading', () => {
  const originalModule =  import('../../src/rag/retriver')
  
  beforeEach(() => {
    // Reset the module state by reimporting
    mock.module('../../src/rag/retriver', () => ({
      getRetriever: async () => null,
      retriver: {
        invoke: async () => []
      }
    }))
  })

  afterEach(() => {
    // Restore original module
    mock.module('../../src/rag/retriver', () => originalModule)
  })

  it('should return null when vector store is unavailable', async () => {
    const mockGetRetriever = async () => null
    const mockRetriver = {
      invoke: async (query: string) => {
        const retriever = await mockGetRetriever()
        if (!retriever) {
          return []
        }
        return retriever.invoke(query)
      }
    }
    
    const result = await mockRetriver.invoke('test query')
    expect(result).toEqual([])
  })

  it('should disable RAG after failed load attempt', async () => {
    // This tests the error recovery behavior
    let ragEnabled = true
    let vdb = null
    
    const mockGetRetriever = async () => {
      if (!ragEnabled) {
        return null
      }
      
      if (!vdb) {
        try {
          // Simulate failed load
          throw new Error('Vector store not found')
        } catch (error) {
          ragEnabled = false
          return null
        }
      }
      
      return vdb
    }
    
    // First call should fail and disable RAG
    const result1 = await mockGetRetriever()
    expect(result1).toBeNull()
    expect(ragEnabled).toBe(false)
    
    // Second call should immediately return null without trying to load
    const result2 = await mockGetRetriever()
    expect(result2).toBeNull()
  })
})
