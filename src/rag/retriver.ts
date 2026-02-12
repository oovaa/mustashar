import { FaissStore } from '@langchain/community/vectorstores/faiss'
import { embeddings } from './embeddings'

const vdb = await FaissStore.load('./vdb/', embeddings)

export const retriver = vdb.asRetriever()


console.log(await retriver.invoke("يحرم من الرضاع ما يحرم من النسب"));
