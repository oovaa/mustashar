import { HNSWLib } from '@langchain/community/vectorstores/hnswlib'
import { embeddings } from './embeddings'
import { logger } from '../logger'

let vdb: HNSWLib | null = null
let ragEnabled = true

/** Lazily loads the HNSWLib vector store and returns a retriever. Returns null if RAG is unavailable or disabled. */
export async function getRetriever() {
  if (!ragEnabled) {
    return null
  }
  
  if (!vdb) {
    try {
      vdb = await HNSWLib.load('./vdb/', embeddings)
      logger.info('HNSWLib vector database loaded successfully')
    } catch (error) {
      logger.error('Failed to load vector database, disabling RAG:', error)
      ragEnabled = false
      return null
    }
  }
  
  return vdb.asRetriever({ k: 3 })
}

/** Legacy retriever interface for backward compatibility. */
export const retriver = {
  invoke: async (query: string) => {
    const retriever = await getRetriever()
    if (!retriever) {
      return []
    }
    return retriever.invoke(query)
  }
}
