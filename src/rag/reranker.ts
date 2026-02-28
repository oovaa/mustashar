import { embeddings } from "./embeddings";

export async function rerank(
  query: string,
  candidates: any[],
  model = "ALJIACHI/Mizan-Rerank-v1",
  topK = 5
) {
  if (!candidates?.length) return [];

  const hfKey =
    process.env.HF_API_KEY ||
    process.env.HUGGINGFACEHUB_API_KEY;

  const docTexts = candidates.map(c => c.pageContent || "");

  /* ===============================
     TRY CROSS ENCODER (Correct Format)
     =============================== */

  if (hfKey) {
    try {
      const endpoint =
        `https://router.huggingface.co/hf-inference/models/${model}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: {
            source_sentence: query,
            sentences: docTexts,
          },
          options: { wait_for_model: true },
        }),
      });

      const json = await res.json();

      if (res.ok && Array.isArray(json)) {
        const ranked = candidates.map((c, i) => ({
          ...c,
          score: json[i] ?? 0,
        }));

        ranked.sort((a, b) =>
          (b.score ?? 0) - (a.score ?? 0)
        );

        console.log("HF rerank SUCCESS");

        return ranked.slice(0, topK);
      }

    } catch (err) {
      console.warn("HF rerank failed, fallback used");
    }
  }

  /* ===============================
     Fallback: embedding similarity
     =============================== */

  const qVec = await embeddings.embedQuery(query);
  const docVecs = await embeddings.embedDocuments(docTexts);

  const ranked = candidates.map((c, i) => ({
    ...c,
    score: cosine(qVec as number[], docVecs[i] as number[]),
  }));

  ranked.sort((a, b) =>
    (b.score ?? 0) - (a.score ?? 0)
  );

  return ranked.slice(0, topK);
}

function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-12);
}