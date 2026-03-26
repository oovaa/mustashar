import fs from "fs/promises"
import path from "path"
import { chunkLaw } from "./chunkLaw"
import { Document } from "@langchain/core/documents"

async function run() {
  const folder = path.join(process.cwd(), "laws_html")

  let files: string[] = []
  try {
    files = await fs.readdir(folder)
  } catch (err: any) {
    console.error("Failed to read laws_html folder:", err?.message || err)
    process.exit(1)
  }

  const allChunks: any[] = []

  for (const file of files) {
    if (!file.endsWith(".html")) continue

    const filePath = path.join(folder, file)
    const html = await fs.readFile(filePath, "utf8")

    const lawName = file.replace(/\.html$/, "")

    const chunks: Document[] = chunkLaw(html, lawName, "local_html")

    for (const d of chunks) {
      allChunks.push({
        law: d.metadata?.law,
        header: d.metadata?.header,
        text: d.pageContent,
        source: d.metadata?.source,
        metadata: d.metadata,
      })
    }

    console.log("Chunked:", file, "->", chunks.length, "chunks")
  }

  const outPath = path.join(process.cwd(), "laws_chunks.json")
  await fs.writeFile(outPath, JSON.stringify(allChunks, null, 2), "utf8")

  console.log("Wrote chunks to", outPath, "total:", allChunks.length)
}

run()
