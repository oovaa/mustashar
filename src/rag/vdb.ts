import { FaissStore } from '@langchain/community/vectorstores/faiss'
import { embeddings } from './embeddings'
import { loadDocsFromFolder } from './chunker'

const vectorStore = new FaissStore(embeddings, {})

await vectorStore.addDocuments(await loadDocsFromFolder())

await vectorStore.save('./vdb/')

