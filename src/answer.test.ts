import { describe, expect, test, mock } from 'bun:test'

const analyzeUserMessage = mock()
const getHistory = mock()
const updateHistory = mock()
const retriverInvoke = mock()
const createAgent = mock()
const modelFallbackMiddleware = mock(() => ({}))

mock.module('./stand_alone', () => ({
  analyzeUserMessage,
}))

mock.module('./history', () => ({
  getHistory,
  updateHistory,
}))

mock.module('./rag/retriver', () => ({
  retriver: {
    invoke: retriverInvoke,
  },
}))

mock.module('langchain', () => ({
  createAgent,
  modelFallbackMiddleware,
}))

describe('answer()', () => {
  test('non-question path uses chat prompt and updates history', async () => {
    analyzeUserMessage.mockResolvedValue({
      has_quesion: false,
      stand_alone_quesions_array: [],
    })
    getHistory.mockResolvedValue('existing summary')
    updateHistory.mockResolvedValue(undefined)

    const invoke = mock(async () => ({
      messages: [{ content: 'ignore' }, { content: 'final answer' }],
    }))
    createAgent.mockReturnValue({ invoke })

    const { answer } = await import('./answer')
    const result = await answer('hello', 'chat-1')

    expect(result).toBe('final answer')
    expect(retriverInvoke).not.toHaveBeenCalled()
    expect(updateHistory).toHaveBeenCalledWith('hello', 'final answer', 'chat-1')
  })

  test('question path retrieves chunks and uses RAG prompt', async () => {
    analyzeUserMessage.mockResolvedValue({
      has_quesion: true,
      stand_alone_quesions_array: ['q1', 'q2'],
    })
    getHistory.mockResolvedValue('chat summary')
    updateHistory.mockResolvedValue(undefined)
    retriverInvoke.mockResolvedValueOnce([
      { pageContent: 'chunk a' },
      { pageContent: 'chunk b' },
    ])
    retriverInvoke.mockResolvedValueOnce([
      { pageContent: 'chunk b' },
      { pageContent: 'chunk c' },
    ])

    const invoke = mock(async () => ({
      messages: [{ content: 'ignore' }, { content: 'rag answer' }],
    }))
    createAgent.mockReturnValue({ invoke })

    const { answer } = await import('./answer')
    const result = await answer('original q', 'chat-2')

    expect(result).toBe('rag answer')
    expect(retriverInvoke).toHaveBeenCalledTimes(2)
    expect(updateHistory).toHaveBeenCalledWith('original q', 'rag answer', 'chat-2')

    const payloadArg = invoke.mock.calls[0][0].messages as string
    expect(payloadArg).toContain('ORIGINAL QUESTION:')
    expect(payloadArg).toContain('chunk a')
    expect(payloadArg).toContain('chunk b')
    expect(payloadArg).toContain('chunk c')
  })
})
