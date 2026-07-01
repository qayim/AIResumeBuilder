/** Per-million-token pricing (USD). Source: Google AI Gemini API pricing, approximate. */
const MODEL_PRICING_USD: Record<string, { input: number; output: number }> = {
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.3 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-pro': { input: 1.25, output: 10.0 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
}

const DEFAULT_PRICING_USD = { input: 0.1, output: 0.4 }

/** Approximate USD → MYR rate for cost display (update periodically). */
export const USD_TO_MYR = 4.75

export function estimateTokenCost(
  model: string,
  promptTokens: number,
  outputTokens: number,
): number {
  const rates = MODEL_PRICING_USD[model] ?? DEFAULT_PRICING_USD
  const inputCostUsd = (promptTokens / 1_000_000) * rates.input
  const outputCostUsd = (outputTokens / 1_000_000) * rates.output
  return (inputCostUsd + outputCostUsd) * USD_TO_MYR
}

/** Format MYR cost for display — shows more decimals for tiny amounts. */
export function formatCostMyr(myr: number): string {
  if (myr === 0) return 'RM 0.00'
  if (myr < 0.0001) return '< RM 0.0001'
  if (myr < 0.01) return `RM ${myr.toFixed(4)}`
  return `RM ${myr.toFixed(4)}`
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
  label = 'Resume',
): string {
  return `${sanitizeFilePart(jobTitle)}_${sanitizeFilePart(company)}_${sanitizeFilePart(userName)}_${sanitizeFilePart(label)}.docx`
}
