import { load } from "cheerio"
import { Document } from "@langchain/core/documents"

export function chunkLaw(
  html: string,
  lawTitle: string,
  sourceUrl: string
): Document[] {
  const $ = load(html)

  const chunks: Document[] = []

  let headers: string[] = []
  let buffer = ""
  let collecting = false

  $("body").children().each((_, el) => {
    const tag = el.tagName

    if (tag === "h1" || tag === "h2" || tag === "h3") {
      if (collecting && buffer.length > 0) {
        chunks.push(
          new Document({
            pageContent: buffer.trim(),
            metadata: {
              law: lawTitle,
              header: headers.join(" / "),
              source: sourceUrl,
            },
          })
        )

        buffer = ""
        collecting = false
        headers = []
      }

      headers.push($(el).text().trim())
    }

    if (tag === "p") {
      const text = $(el).text().trim()
      if (!text) return

      collecting = true
      buffer += text + "\n"
    }
  })

  if (buffer.length > 0) {
    chunks.push(
      new Document({
        pageContent: buffer.trim(),
        metadata: {
          law: lawTitle,
          header: headers.join(" / "),
          source: sourceUrl,
        },
      })
    )
  }

  return chunks
}