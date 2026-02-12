import { HNSWLib } from '@langchain/community/vectorstores/hnswlib'
import { embeddings } from './embeddings'

const vdb = await HNSWLib.load('./vdb/', embeddings)

export const retriver = vdb.asRetriever()

console.log(await retriver.invoke('يحرم من الرضاع ما يحرم من النسب'))
