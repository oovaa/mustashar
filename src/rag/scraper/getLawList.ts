import axios from "axios"
import * as cheerio from "cheerio"

export interface LawLink {
  title: string
  url: string
}

export async function getLawList(): Promise<LawLink[]> {
  const url =
    "https://moj.gov.sd/sudanlaws/epub/EPUB/xhtml/contents.html"

  const response = await axios.get(url)
  const $ = cheerio.load(response.data)

  const laws: LawLink[] = []

  $("a").each((_, el) => {
    const title = $(el).text().trim()
    const href = $(el).attr("href")

    if (href && href.endsWith(".html")) {
      laws.push({
        title,
        url:
          "https://moj.gov.sd/sudanlaws/epub/EPUB/xhtml/" + href,
      })
    }
  })

  return laws
}