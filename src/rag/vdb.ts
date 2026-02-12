import { FaissStore } from '@langchain/community/vectorstores/faiss'
import { embeddings } from './embeddings'
import { loadDocsFromFolder } from './chunker'

const vectorStore = new FaissStore(embeddings, {})

const docs = await loadDocsFromFolder()

console.log('docs are loaded')

await vectorStore.addDocuments(docs)

console.log('done now saving')

await vectorStore.save('./vdb/')
