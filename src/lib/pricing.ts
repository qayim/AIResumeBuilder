/** Per-million-token pricing (USD). Source: Google AI Gemini API pricing, approximate. */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.3 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-pro': { input: 1.25, output: 10.0 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
}

const DEFAULT_PRICING = { input: 0.1, output: 0.4 }

export function estimateTokenCost(
  model: string,
  promptTokens: number,
  outputTokens: number,
): number {
  const rates = MODEL_PRICING[model] ?? DEFAULT_PRICING
  const inputCost = (promptTokens / 1_000_000) * rates.input
  const outputCost = (outputTokens / 1_000_000) * rates.output
  return inputCost + outputCost
}

/** Format USD cost for display — shows more decimals for tiny amounts. */
export function formatCostUsd(usd: number): string {
  if (usd === 0) return '$0.00'
  if (usd < 0.0001) return '< $0.0001'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(4)}`
}

export function sanitizeFilePart(value: string): string {
  return (
    value
      .trim()
      .replace(/[^\w\-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'Unknown'
  )
}

export function buildResumeFileName(
  jobTitle: string,
  company: string,
  userName: string,
): string {
  return `${sanitizeFilePart(jobTitle)}_${sanitizeFilePart(company)}_${sanitizeFilePart(userName)}_Resume.docx`
}
