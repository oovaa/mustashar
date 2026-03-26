import fs from "fs/promises"
import path from "path"
import { getLawList } from "./getLawList"
import { downloadLaw } from "./downloadLaw"

async function run() {
  console.log("Getting law list...")

  const laws = await getLawList()
  console.log("Total laws:", laws.length)

  const folder = path.join(process.cwd(), "laws_html")
  await fs.mkdir(folder, { recursive: true })

  for (const law of laws) {
    try {
      console.log("Downloading:", law.title)
      const html = await downloadLaw(law.url)

      const filename = law.title.replace(/\s+/g, "_") + ".html"

      await fs.writeFile(path.join(folder, filename), html, "utf8")
      console.log("Saved", filename)
    } catch (err: any) {
      console.warn("Failed to download/save", law.title, err?.message || err)
    }
  }

  console.log("All done. HTML files saved to:", folder)
}

run()
