export function rrfFuse(lists: Array<any[]>, k: number = 60) {
  const scoreMap = new Map<string, number>()
  const itemMap = new Map<string, any>()

  lists.forEach((lst) => {
    lst.forEach((doc: any, idx: number) => {
      const key = `${doc.metadata?.source || ''}::${doc.metadata?.rule || ''}`
      const rank = idx + 1
      const add = 1 / (k + rank)
      scoreMap.set(key, (scoreMap.get(key) ?? 0) + add)
      if (!itemMap.has(key)) itemMap.set(key, doc)
    })
  })

  const fused = Array.from(scoreMap.entries()).map(([key, score]) => ({
    key,
    score,
    doc: itemMap.get(key),
  }))

  fused.sort((a, b) => b.score - a.score)

  return fused.map(f => f.doc)
}
