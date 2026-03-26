import { Document } from "@langchain/core/documents"

export function parseLegalText(
  text: string,
  source: string,
  lawName: string
): Document[] {

  const lines = text.split("\n")
  const docs: Document[] = []

  let kitab: string | null = null
  let kitabName: string | null = null

  let baab: string | null = null
  let baabName: string | null = null

  let fasl: string | null = null
  let faslName: string | null = null

  let faraa: string | null = null
  let faraaName: string | null = null

  let currentRule: string | null = null
  let buffer: string[] = []

  const ruleRegex = /^r(\d+):/i

  function readName(
    startIndex: number,
    endMarker: string
  ) {
    const nameLines: string[] = []
    let i = startIndex + 1

    while (i < lines.length) {

      const l = lines[i].trim()

      if (!l) {
        i++
        continue
      }

      if (l.includes(endMarker)) {
        return {
          name: nameLines.join(" ").trim(),
          newIndex: i
        }
      }

      nameLines.push(l)
      i++
    }

    return {
      name: nameLines.join(" ").trim(),
      newIndex: i
    }
  }

  for (let i = 0; i < lines.length; i++) {

    const line = lines[i].trim()

    if (!line) continue

    // ---------- KITAB ----------
    if (line.includes("(kitab)")) {

      const match = line.match(/الكتاب\s+([^\s]+)/)
      kitab = match ? match[1] : null

      const result = readName(i, "(kitab name)")
      kitabName = result.name
      i = result.newIndex

      continue
    }

    // ---------- BAAB ----------
    if (line.includes("(baab)")) {

      const match = line.match(/الباب\s+([^\s]+)/)
      baab = match ? match[1] : null

      const result = readName(i, "(baab name)")
      baabName = result.name
      i = result.newIndex

      continue
    }

    // ---------- FASL ----------
    if (line.includes("(fasl)")) {

      const match = line.match(/الفصل\s+([^\s]+)/)
      fasl = match ? match[1] : null

      const result = readName(i, "(fasl name)")
      faslName = result.name
      i = result.newIndex

      continue
    }

    // ---------- FARAA ----------
    if (line.includes("(faraa)")) {

      const match = line.match(/الفرع\s+([^\s]+)/)
      faraa = match ? match[1] : null

      const result = readName(i, "(faraa name)")
      faraaName = result.name
      i = result.newIndex

      continue
    }

    // ---------- RULE ----------
    const ruleMatch = line.match(ruleRegex)

    if (ruleMatch) {

      if (currentRule && buffer.length) {

        docs.push(
          new Document({
            pageContent: buffer.join("\n"),
            metadata: {
              source,
              law: lawName,

              kitab,
              kitabName,

              baab,
              baabName,

              fasl,
              faslName,

              faraa,
              faraaName,

              rule: currentRule
            }
          })
        )
      }

      currentRule = ruleMatch[1]
      buffer = []
      continue
    }

    if (currentRule) buffer.push(line)
  }

  if (currentRule && buffer.length) {

    docs.push(
      new Document({
        pageContent: buffer.join("\n"),
        metadata: {
          source,
          law: lawName,

          kitab,
          kitabName,

          baab,
          baabName,

          fasl,
          faslName,

          faraa,
          faraaName,

          rule: currentRule
        }
      })
    )
  }

  return docs
}