import { VoyageEmbeddings } from '@langchain/community/embeddings/voyage'

export const embeddings = new VoyageEmbeddings({
  apiKey: 'pa-dEbiEQ9BSlDw5GKYYnKSTDAQ5hd36lFkSOWMMPCYKmz', // In Node.js defaults to process.env.VOYAGEAI_API_KEY
  modelName: 'voyage-4-large',
})

// console.log(await embeddings.embedQuery('omar'))
