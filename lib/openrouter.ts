type TextPart = { type: "text"; text: string }
type ImagePart = { type: "image_url"; image_url: { url: string } }
export type OpenRouterPart = TextPart | ImagePart

function cleanJson(text: string) {
  const trimmed = text.trim().replace(/^\`\`\`(?:json)?/i, "").replace(/\`\`\`$/, "").trim()
  const firstObject = trimmed.indexOf("{")
  const firstArray = trimmed.indexOf("[")
  const start = firstArray >= 0 && (firstObject < 0 || firstArray < firstObject) ? firstArray : firstObject
  if (start < 0) return trimmed
  const end = trimmed[start] === "[" ? trimmed.lastIndexOf("]") : trimmed.lastIndexOf("}")
  return end >= start ? trimmed.slice(start, end + 1) : trimmed.slice(start)
}

export function parseModelJson<T>(text: string): T {
  return JSON.parse(cleanJson(text)) as T
}

async function requestModel(model: string, content: string | OpenRouterPart[]) {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error("OPENROUTER_API_KEY is not configured")

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(process.env.APP_URL ? { "HTTP-Referer": process.env.APP_URL } : {}),
      "X-Title": "Asset Archaeologist",
    },
    body: JSON.stringify({
      model,
      temperature: 0.15,
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenRouter request failed (${response.status})`)
  }

  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new Error("OpenRouter returned no content")
  return String(text)
}

export async function callOpenRouter(content: string | OpenRouterPart[]) {
  const primary = process.env.OPENROUTER_MODEL || "qwen/qwen3.7-flash"
  try {
    return await requestModel(primary, content)
  } catch (primaryError) {
    const fallback = process.env.OPENROUTER_FALLBACK_MODEL || "qwen/qwen3.8-27b:free"
    if (!fallback || fallback === primary) throw primaryError
    console.warn("Primary OpenRouter model failed; trying fallback", primaryError)
    return requestModel(fallback, content)
  }
}
