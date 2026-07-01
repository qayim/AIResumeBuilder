/**
 * Strip markdown fences and isolate the outermost JSON object from model text.
 */
export function extractJsonText(text: string): string {
  let trimmed = text.trim()

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenced) trimmed = fenced[1].trim()

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start !== -1 && end > start) {
    trimmed = trimmed.slice(start, end + 1)
  }

  return trimmed
}

export function parseJsonText(text: string): unknown {
  const jsonText = extractJsonText(text)
  return JSON.parse(jsonText)
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
