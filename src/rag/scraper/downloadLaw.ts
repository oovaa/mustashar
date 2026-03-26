import axios from "axios"

export async function downloadLaw(url: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await axios.get(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    })
    return res.data
  } catch (err: any) {
    console.warn("Download failed:", url, err?.message || err)
    throw err
  } finally {
    clearTimeout(timeout)
  }
}