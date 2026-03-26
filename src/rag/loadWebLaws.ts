import fs from "fs/promises"
import path from "path"
import { Document } from "@langchain/core/documents"
import { getLawList } from "./scraper/getLawList"
import { downloadLaw } from "./scraper/downloadLaw"
import { chunkLaw } from "./scraper/chunkLaw"

const OUT_FILE = "laws_web_chunks.json"
const CONCURRENCY = 5

export async function loadWebLaws(): Promise<Document[]> {
  const docs: Document[] = []

  // 🔹 Load previous progress (resume support)
  let existing: any[] = []
  try {
    const raw = await fs.readFile(OUT_FILE, "utf8")
    existing = JSON.parse(raw)
    console.log("Loaded existing chunks:", existing.length)
  } catch {}

  const processed = new Set(existing.map((e) => e.source))

  const laws = await getLawList()
  console.log(`Found ${laws.length} laws`)

  for (let i = 0; i < laws.length; i += CONCURRENCY) {
    const batch = laws.slice(i, i + CONCURRENCY)

    await Promise.all(
      batch.map(async (law) => {
        try {
          if (processed.has(law.url)) {
            console.log("Skipping:", law.title)
            return
          }

          console.log("Downloading:", law.title)

          const html = await downloadLaw(law.url)
          const chunks = chunkLaw(html, law.title, law.url)

          docs.push(...chunks)
          processed.add(law.url)
        } catch (err) {
          console.warn("Failed:", law.title)
        }
      })
    )

    console.log(`Progress: ${i + batch.length}/${laws.length}`)

    // 🔹 Save checkpoint every batch
    const out = [
      ...existing,
      ...docs.map((d) => ({
        law: d.metadata?.law,
        header: d.metadata?.header,
        text: d.pageContent,
        source: d.metadata?.source,
        metadata: d.metadata,
      })),
    ]

    await fs.writeFile(OUT_FILE, JSON.stringify(out, null, 2), "utf8")
    console.log("Checkpoint saved:", out.length)
  }

  console.log("Finished all laws ✅")

  return docs
}

loadWebLaws().catch((err) => {
  console.error("Fatal error:", err)
})