import fs from "fs/promises"
import path from "path"
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf"
import { TextLoader } from "@langchain/classic/document_loaders/fs/text"
import { parseLegalText } from "./legalParser"
import { Document } from "@langchain/core/documents"

export async function loadDocsFromFolder(
  folderPath: string = "./docs"
): Promise<Document[]> {

  const docs: Document[] = []

  const pdfFiles = await findFiles(folderPath, [".pdf"])
  const textFiles = await findFiles(folderPath, [".txt", ".md"])

  // ---------- LOAD PDF ----------
  for (const pdfPath of pdfFiles) {

    try {

      const loader = new PDFLoader(pdfPath)
      const rawDocs = await loader.load()

      const fullText = rawDocs.map(d => d.pageContent).join("\n")

      const lawName = path.basename(pdfPath).replace(".pdf", "")

      const parsedDocs = parseLegalText(
        fullText,
        pdfPath,
        lawName
      )

      docs.push(...parsedDocs)

    } catch (error) {

      console.warn(`Failed to load PDF ${pdfPath}:`, error)

    }
  }

  // ---------- LOAD TEXT ----------
  for (const textPath of textFiles) {

    try {

      const loader = new TextLoader(textPath)
      const rawDocs = await loader.load()

      const fullText = rawDocs.map(d => d.pageContent).join("\n")

      const lawName = path.basename(textPath).replace(".txt", "")

      const parsedDocs = parseLegalText(
        fullText,
        textPath,
        lawName
      )

      docs.push(...parsedDocs)

    } catch (error) {

      console.warn(`Failed to load text ${textPath}:`, error)

    }
  }

  console.log(`Loaded ${docs.length} legal chunks`)

  await fs.writeFile(
    "./debug_chunks.json",
    JSON.stringify(docs, null, 2)
  )

  return docs
}

// ---------- RECURSIVE FILE SEARCH ----------
async function findFiles(
  dir: string,
  extensions: string[]
): Promise<string[]> {

  const files: string[] = []

  const entries = await fs.readdir(dir, { withFileTypes: true })

  for (const entry of entries) {

    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {

      files.push(...await findFiles(fullPath, extensions))

    } else {

      const ext = path.extname(entry.name).toLowerCase()

      if (extensions.includes(ext)) {
        files.push(fullPath)
      }

    }
  }

  return files
}