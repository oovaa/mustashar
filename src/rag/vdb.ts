import { HNSWLib } from '@langchain/community/vectorstores/hnswlib'
import { embeddings } from './embeddings'
import { loadDocsFromFolder } from './chunker'
import { logger } from '../logger'

const vectorStore = await HNSWLib.fromDocuments([], embeddings)

const docs = await loadDocsFromFolder()

logger.info('docs are loaded')

await vectorStore.addDocuments(docs)

logger.info('done now saving')

await vectorStore.save('./vdb/')
