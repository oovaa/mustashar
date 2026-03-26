import fs from "fs/promises"
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib"
import { embeddings } from "./embeddings"
import { Document } from "@langchain/core/documents"

const vectorStore = await HNSWLib.fromDocuments([], embeddings)

// Load your chunked laws
const raw = await fs.readFile("./laws_web_chunks.json", "utf8")
const data = JSON.parse(raw)

const docs: Document[] = data.map(
  (d: any) =>
    new Document({
      pageContent: d.text,
      metadata: d.metadata,
    })
)

console.log("Docs loaded:", docs.length)

// ⚡ Replace single addDocuments with batching
const BATCH_SIZE = 25

for (let i = 0; i < docs.length; i += BATCH_SIZE) {
  const batch = docs.slice(i, i + BATCH_SIZE)
  console.log(`Embedding batch ${i + 1} -> ${i + batch.length}`)
  await vectorStore.addDocuments(batch)
}

console.log("Saving vector DB...")
await vectorStore.save("./vdb/")
console.log("Done ✅")