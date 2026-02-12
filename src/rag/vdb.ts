import { HNSWLib } from '@langchain/community/vectorstores/hnswlib'
import { embeddings } from './embeddings'
import { loadDocsFromFolder } from './chunker'

const vectorStore = await HNSWLib.fromDocuments([], embeddings)

const docs = await loadDocsFromFolder()

console.log('docs are loaded')

await vectorStore.addDocuments(docs)

console.log('done now saving')

await vectorStore.save('./vdb/')
