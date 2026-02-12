import fs from 'fs/promises'
import path from 'path'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf'
import { TextLoader } from '@langchain/classic/document_loaders/fs/text'
import { Document } from '@langchain/core/documents'

export async function loadDocsFromFolder(
  folderPath: string = './docs',
): Promise<Document[]> {
  const docs: Document[] = []
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 800,
    chunkOverlap: 0,
  })

  // Recursively find all .pdf, .txt, .md files
  const pdfFiles = await findFiles(folderPath, ['.pdf'])
  const textFiles = await findFiles(folderPath, ['.txt', '.md'])

  // Load PDFs
  for (const pdfPath of pdfFiles) {
    try {
      const loader = new PDFLoader(pdfPath)
      const rawDocs = await loader.load()

      // Add source metadata
      const processedDocs = rawDocs.map(
        (doc) =>
          new Document({
            pageContent: doc.pageContent,
            metadata: {
              source: pdfPath,
              page: doc.metadata.page || 'unknown',
              ...doc.metadata,
            },
          }),
      )

      // Split into chunks
      const chunks = await splitter.splitDocuments(processedDocs)
      docs.push(...chunks)
    } catch (error) {
      console.warn(`Failed to load PDF ${pdfPath}:`, error)
    }
  }

  // Load text files
  for (const textPath of textFiles) {
    try {
      const loader =
        path.extname(textPath) === '.md'
          ? new TextLoader(textPath) // MD as plain text (use UnstructuredMarkdownLoader if needed)
          : new TextLoader(textPath)

      const rawDoc = await loader.load()
      const docWithSource = new Document({
        pageContent: rawDoc[0].pageContent,
        metadata: { source: textPath, ...rawDoc[0].metadata },
      })

      // Split into chunks
      const chunks = await splitter.splitDocuments([docWithSource])
      docs.push(...chunks)
    } catch (error) {
      console.warn(`Failed to load text ${textPath}:`, error)
    }
  }

  console.log(
    `Loaded ${docs.length} chunks from ${pdfFiles.length + textFiles.length} files`,
  )
  return docs
}

// Helper: Recursively find files by extensions
async function findFiles(dir: string, extensions: string[]): Promise<string[]> {
  const files: string[] = []

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        files.push(...(await findFiles(fullPath, extensions))) // Recurse
      } else {
        const ext = path.extname(entry.name).toLowerCase()
        if (extensions.includes(ext)) {
          files.push(fullPath)
        }
      }
    }
  } catch (error) {
    console.warn(`Error reading ${dir}:`, error)
  }

  return files
}
