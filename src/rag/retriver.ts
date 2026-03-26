import { HNSWLib } from '@langchain/community/vectorstores/hnswlib'
import { embeddings } from './embeddings'

let vdb

try {
	vdb = await HNSWLib.load('./vdb/', embeddings)
	console.log('Loaded vector DB from ./vdb/')
} catch (err) {
	console.warn('Failed to load vector DB from ./vdb/:', err?.message ?? err)
	console.warn('Falling back to an empty in-memory vector store. Build the vdb with `bun run src/rag/vdb.ts` to enable retrieval.')
	vdb = await HNSWLib.fromDocuments([], embeddings)
}

export const retriver = vdb.asRetriever({ k: 3 })
