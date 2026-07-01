import type {
  GenerationMode,
  GenerationResult,
  InterviewAnalysis,
  Settings,
  TailoredResume,
  TokenUsage,
} from '../types'
import { estimateTokenCost } from './pricing'
import { isRecord, parseJsonText } from './jsonParse'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

/** Per-model output token ceiling (API limits). */
const MODEL_MAX_OUTPUT: Record<string, number> = {
  'gemini-2.0-flash': 8192,
  'gemini-2.0-flash-lite': 8192,
  'gemini-2.5-flash': 65536,
  'gemini-2.5-pro': 65536,
  'gemini-1.5-flash': 8192,
  'gemini-1.5-pro': 8192,
}

export type ProgressCallback = (message: string) => void

/** Models the user can pick from in Settings. */
export const AVAILABLE_MODELS = [
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (fast, cheap)' },
  { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-Lite (cheapest)' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (balanced)' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (highest quality)' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (legacy)' },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (legacy)' },
]

const stringArray = { type: 'ARRAY', items: { type: 'STRING' } }

const resumeObjectSchema = {
  type: 'OBJECT',
  properties: {
    contact: {
      type: 'OBJECT',
      properties: {
        fullName: { type: 'STRING' },
        title: { type: 'STRING' },
        email: { type: 'STRING' },
        phone: { type: 'STRING' },
        location: { type: 'STRING' },
        links: stringArray,
      },
    },
    summary: { type: 'STRING' },
    skills: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          category: { type: 'STRING' },
          skills: stringArray,
        },
        required: ['category', 'skills'],
      },
    },
    experience: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          company: { type: 'STRING' },
          role: { type: 'STRING' },
          location: { type: 'STRING' },
          startDate: { type: 'STRING' },
          endDate: { type: 'STRING' },
          bullets: stringArray,
        },
      },
    },
    education: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          institution: { type: 'STRING' },
          degree: { type: 'STRING' },
          location: { type: 'STRING' },
          startDate: { type: 'STRING' },
          endDate: { type: 'STRING' },
          details: stringArray,
        },
      },
    },
    certifications: stringArray,
    projects: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          description: { type: 'STRING' },
        },
      },
    },
  },
  required: ['contact', 'summary', 'skills', 'experience', 'education'],
}

const analysisSchema = {
  type: 'OBJECT',
  properties: {
    interviewChance: { type: 'INTEGER' },
    verdict: { type: 'STRING' },
    jobTitle: { type: 'STRING' },
    company: { type: 'STRING' },
    matchedKeywords: stringArray,
    missingKeywords: stringArray,
    suggestions: stringArray,
    reasoning: { type: 'STRING' },
  },
  required: [
    'interviewChance',
    'verdict',
    'jobTitle',
    'company',
    'matchedKeywords',
    'missingKeywords',
    'suggestions',
    'reasoning',
  ],
}

const resumeOnlyResponseSchema = {
  type: 'OBJECT',
  properties: { resume: resumeObjectSchema },
  required: ['resume'],
}

const RESUME_ONLY_INSTRUCTION = `You are an expert resume writer specializing in ATS-optimized resumes.

Rewrite the candidate's resume so it is tailored to the job description. Return ONLY the tailored resume as JSON — no interview analysis.

Strict rules:
- NEVER invent experience, employers, dates, degrees, or skills the candidate does not have.
- Mirror job-description keywords where the candidate genuinely qualifies.
- Use strong action verbs; quantify impact when numbers exist in the original.
- Keep the summary to 2-3 sentences (under 70 words).
- Max 4 bullet points per experience entry; keep each bullet under 25 words.
- Max 3 skill categories; list only the most relevant skills.
- Include projects and certifications only if present in the original resume.
- If a field is unknown, use an empty string or empty array.

Respond ONLY with JSON conforming to the schema.`

const ANALYSIS_COMPACT_RULES = `
Keep analysis output SHORT to fit token limits:
- matchedKeywords: max 8 items, short phrases only
- missingKeywords: max 8 items
- suggestions: max 4 items, under 15 words each
- reasoning: one paragraph, max 60 words
- verdict: max 5 words (e.g. "Strong match", "Moderate fit")
`

const FIT_ONLY_INSTRUCTION = `You are an expert technical recruiter with deep ATS knowledge.

Analyze how well the candidate's resume matches the job description. Estimate realistic interview chance (0-100).

Do NOT rewrite the resume — analysis only.

Scoring rules:
- interviewChance: calibrated 0-100 based on genuine qualification overlap.
- jobTitle: short title from the job description (e.g. "Software Engineer").
- company: hiring company name, or "Unknown" if not stated.
- matchedKeywords / missingKeywords / suggestions / reasoning: honest and specific.
${ANALYSIS_COMPACT_RULES}

Respond ONLY with JSON conforming to the schema.`

const TAILORED_ANALYSIS_INSTRUCTION = `You are an expert technical recruiter with deep ATS knowledge.

Analyze how well the TAILORED resume matches the job description. Estimate the candidate's realistic chance (0-100) of landing an interview WITH this tailored resume.

Do NOT rewrite the resume — analysis only.

Scoring rules:
- interviewChance: score reflects THIS tailored resume, not the original.
- jobTitle / company: extract from the job description.
- matchedKeywords / missingKeywords / suggestions / reasoning: be honest and calibrated.
${ANALYSIS_COMPACT_RULES}

Respond ONLY with JSON conforming to the schema.`

export interface GeminiError extends Error {
  status?: number
}

type RequestKind = 'fit-only' | 'resume-only' | 'tailored-analysis'

function outputLimit(model: string, requested: number): number {
  const cap = MODEL_MAX_OUTPUT[model] ?? 8192
  return Math.min(Math.max(requested, 1024), cap)
}

function truncateInput(text: string, maxChars: number): string {
  const t = text.trim()
  if (t.length <= maxChars) return t
  return `${t.slice(0, maxChars)}\n...[truncated]`
}

function buildInputs(jobDescription: string, resumeText: string) {
  return `JOB DESCRIPTION:
"""
${truncateInput(jobDescription, 10000)}
"""

RESUME:
"""
${truncateInput(resumeText, 8000)}
"""`
}

function buildPrompt(
  jobDescription: string,
  resumeText: string,
  kind: RequestKind,
): string {
  const base = buildInputs(jobDescription, resumeText)

  if (kind === 'fit-only') {
    return `${base}

Analyze fit between this resume and job description. Return interview analysis JSON only.`
  }

  if (kind === 'resume-only') {
    return `${base}

Produce the tailored resume as JSON only. Keep output compact to stay within token limits.`
  }

  return `${base}

This is the TAILORED resume (already rewritten for the role). Analyze interview fit and return analysis JSON only.`
}

function extractUsage(raw: unknown, model: string): TokenUsage {
  const meta = (raw as { usageMetadata?: Record<string, number> })?.usageMetadata ?? {}
  const promptTokens = meta.promptTokenCount ?? 0
  const outputTokens = meta.candidatesTokenCount ?? 0
  const totalTokens = meta.totalTokenCount ?? 0
  return {
    promptTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd: estimateTokenCost(model, promptTokens, outputTokens),
  }
}

function mergeUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    estimatedCostUsd: a.estimatedCostUsd + b.estimatedCostUsd,
  }
}

function extractText(raw: unknown): { text: string; finishReason?: string } {
  const data = raw as {
    candidates?: {
      content?: { parts?: { text?: string }[] }
      finishReason?: string
    }[]
    promptFeedback?: { blockReason?: string }
  }

  if (data.promptFeedback?.blockReason) {
    throw new Error(`Request was blocked by Gemini safety filters (${data.promptFeedback.blockReason}).`)
  }

  const candidate = data.candidates?.[0]
  const finishReason = candidate?.finishReason
  const parts = candidate?.content?.parts ?? []
  const text = parts.map((p) => p.text ?? '').join('')

  if (!text) {
    if (finishReason === 'MAX_TOKENS') {
      throw new Error(
        'Gemini hit the max output token limit. Try Fit check only mode, or shorten your resume input.',
      )
    }
    throw new Error('Gemini returned an empty response. Try again or switch models.')
  }
  return { text, finishReason }
}

function emptyResume(): TailoredResume {
  return {
    contact: { fullName: '', title: '', email: '', phone: '', location: '', links: [] },
    summary: '',
    skills: [],
    experience: [],
    education: [],
    certifications: [],
    projects: [],
  }
}

function coerceAnalysis(value: unknown): InterviewAnalysis {
  if (!isRecord(value)) {
    throw new Error('Response is missing the interview analysis object.')
  }
  return {
    interviewChance: Number(value.interviewChance ?? 0),
    verdict: String(value.verdict ?? ''),
    jobTitle: String(value.jobTitle ?? ''),
    company: String(value.company ?? ''),
    matchedKeywords: Array.isArray(value.matchedKeywords)
      ? value.matchedKeywords.map(String).slice(0, 12)
      : [],
    missingKeywords: Array.isArray(value.missingKeywords)
      ? value.missingKeywords.map(String).slice(0, 12)
      : [],
    suggestions: Array.isArray(value.suggestions) ? value.suggestions.map(String).slice(0, 6) : [],
    reasoning: String(value.reasoning ?? '').slice(0, 600),
  }
}

function trimBullets(items: { bullets?: string[] }[], max: number) {
  for (const item of items) {
    if (Array.isArray(item.bullets) && item.bullets.length > max) {
      item.bullets = item.bullets.slice(0, max)
    }
  }
}

function coerceResume(value: unknown): TailoredResume {
  if (!isRecord(value)) return emptyResume()

  const contact = isRecord(value.contact) ? value.contact : {}
  const resume: TailoredResume = {
    contact: {
      fullName: String(contact.fullName ?? ''),
      title: String(contact.title ?? ''),
      email: String(contact.email ?? ''),
      phone: String(contact.phone ?? ''),
      location: String(contact.location ?? ''),
      links: Array.isArray(contact.links) ? contact.links.map(String) : [],
    },
    summary: String(value.summary ?? ''),
    skills: Array.isArray(value.skills) ? (value.skills as TailoredResume['skills']).slice(0, 4) : [],
    experience: Array.isArray(value.experience)
      ? (value.experience as TailoredResume['experience'])
      : [],
    education: Array.isArray(value.education)
      ? (value.education as TailoredResume['education'])
      : [],
    certifications: Array.isArray(value.certifications)
      ? value.certifications.map(String).slice(0, 10)
      : [],
    projects: Array.isArray(value.projects)
      ? (value.projects as TailoredResume['projects']).slice(0, 5)
      : [],
  }

  trimBullets(resume.experience, 4)
  return resume
}

function parseAnalysisResponse(text: string, finishReason?: string): InterviewAnalysis {
  let parsed: unknown
  try {
    parsed = parseJsonText(text)
  } catch {
    if (finishReason === 'MAX_TOKENS') {
      throw new Error('Analysis response was cut off. Please try again.')
    }
    throw new Error('Gemini returned malformed analysis JSON. Please try again.')
  }

  if (!isRecord(parsed)) {
    throw new Error('Gemini returned an unexpected analysis shape.')
  }

  const source =
    'analysis' in parsed && isRecord(parsed.analysis) ? parsed.analysis : parsed
  return normalizeAnalysis(coerceAnalysis(source))
}

function parseResumeResponse(text: string, finishReason?: string): TailoredResume {
  let parsed: unknown
  try {
    parsed = parseJsonText(text)
  } catch {
    if (finishReason === 'MAX_TOKENS') {
      throw new Error(
        'Resume output was cut off — your resume may be too long for one pass. Try shortening your input, or use Fit check only mode first.',
      )
    }
    throw new Error('Gemini returned malformed resume JSON. Please try again.')
  }

  if (!isRecord(parsed)) {
    throw new Error('Gemini returned an unexpected resume shape.')
  }

  const source = 'resume' in parsed ? parsed.resume : parsed
  return coerceResume(source)
}

function resumeToAnalysisSummary(resume: TailoredResume): string {
  const skillList = resume.skills
    .flatMap((g) => g.skills)
    .slice(0, 20)
    .join(', ')
  const jobs = resume.experience
    .slice(0, 6)
    .map((e) => `${e.role} @ ${e.company} (${(e.bullets ?? []).length} bullets)`)
    .join('; ')
  return [
    `Name: ${resume.contact.fullName}`,
    `Target title: ${resume.contact.title}`,
    `Summary: ${resume.summary.slice(0, 400)}`,
    skillList ? `Skills: ${skillList}` : '',
    jobs ? `Experience: ${jobs}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

async function callGemini(
  settings: Settings,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<{ raw: unknown; text: string; finishReason?: string }> {
  const url = `${API_BASE}/${encodeURIComponent(settings.model)}:generateContent?key=${encodeURIComponent(
    settings.apiKey,
  )}`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new Error('Network error contacting Gemini. Check your connection and try again.')
  }

  const raw = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      (raw as { error?: { message?: string } })?.error?.message ??
      `Gemini request failed (HTTP ${response.status}).`
    const error: GeminiError = new Error(humanizeError(response.status, message))
    error.status = response.status
    throw error
  }

  const { text, finishReason } = extractText(raw)
  if (finishReason === 'MAX_TOKENS') {
    // Still attempt parse — may partially succeed on retry path
  }
  return { raw, text, finishReason }
}

function requestBody(
  settings: Settings,
  kind: RequestKind,
  prompt: string,
  maxOutputTokens: number,
  concise = false,
): Record<string, unknown> {
  const instructions: Record<RequestKind, string> = {
    'fit-only': concise
      ? `${FIT_ONLY_INSTRUCTION}\n\nBe extremely brief — half the normal length.`
      : FIT_ONLY_INSTRUCTION,
    'resume-only': concise
      ? `${RESUME_ONLY_INSTRUCTION}\n\nIMPORTANT: Prior pass was too long. Be extra concise — max 3 bullets per job, shorter summary.`
      : RESUME_ONLY_INSTRUCTION,
    'tailored-analysis': concise
      ? `${TAILORED_ANALYSIS_INSTRUCTION}\n\nBe extremely brief — half the normal length.`
      : TAILORED_ANALYSIS_INSTRUCTION,
  }

  const schemas: Record<RequestKind, unknown> = {
    'fit-only': analysisSchema,
    'resume-only': resumeOnlyResponseSchema,
    'tailored-analysis': analysisSchema,
  }

  return {
    systemInstruction: { parts: [{ text: instructions[kind] }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: concise ? Math.min(settings.temperature, 0.2) : settings.temperature,
      maxOutputTokens,
      responseMimeType: 'application/json',
      responseSchema: schemas[kind],
    },
  }
}

async function runRequest(
  settings: Settings,
  kind: RequestKind,
  jobDescription: string,
  resumeText: string,
  maxOutputTokens: number,
  signal?: AbortSignal,
  concise = false,
): Promise<{ raw: unknown; text: string; finishReason?: string }> {
  const body = requestBody(
    settings,
    kind,
    buildPrompt(jobDescription, resumeText, kind),
    maxOutputTokens,
    concise,
  )
  return callGemini(settings, body, signal)
}

function normalizeAnalysis(analysis: InterviewAnalysis): InterviewAnalysis {
  return {
    ...analysis,
    interviewChance: Math.max(0, Math.min(100, Math.round(analysis.interviewChance ?? 0))),
    jobTitle: analysis.jobTitle?.trim() || 'Job',
    company: analysis.company?.trim() || 'Unknown',
  }
}

async function generateResumeStep(
  settings: Settings,
  jobDescription: string,
  currentResume: string,
  signal?: AbortSignal,
): Promise<{ resume: TailoredResume; usage: TokenUsage }> {
  const maxTokens = outputLimit(settings.model, settings.maxOutputTokens)

  for (let attempt = 0; attempt < 2; attempt++) {
    const { raw, text, finishReason } = await runRequest(
      settings,
      'resume-only',
      jobDescription,
      currentResume,
      maxTokens,
      signal,
      attempt === 1,
    )

    try {
      const resume = parseResumeResponse(text, finishReason)
      if (finishReason === 'MAX_TOKENS' && attempt === 0) continue
      return { resume, usage: extractUsage(raw, settings.model) }
    } catch (err) {
      if (attempt === 1 || finishReason !== 'MAX_TOKENS') throw err
    }
  }

  throw new Error(
    'Could not generate a complete resume within token limits. Try shortening your resume or use Fit check only mode.',
  )
}

async function generateAnalysisStep(
  settings: Settings,
  jobDescription: string,
  resumeText: string,
  kind: 'fit-only' | 'tailored-analysis',
  signal?: AbortSignal,
): Promise<{ analysis: InterviewAnalysis; usage: TokenUsage }> {
  const maxTokens = outputLimit(settings.model, 4096)
  let totalUsage: TokenUsage = {
    promptTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const { raw, text, finishReason } = await runRequest(
      settings,
      kind,
      jobDescription,
      resumeText,
      maxTokens,
      signal,
      attempt === 1,
    )
    totalUsage = mergeUsage(totalUsage, extractUsage(raw, settings.model))

    try {
      const analysis = parseAnalysisResponse(text, finishReason)
      return { analysis, usage: totalUsage }
    } catch (err) {
      if (attempt === 1) throw err
      if (finishReason !== 'MAX_TOKENS' && !/malformed analysis JSON/i.test((err as Error).message)) {
        throw err
      }
    }
  }

  throw new Error('Analysis could not be completed. Please try again or use Fit check only mode.')
}

export async function generateTailoredResume(
  settings: Settings,
  jobDescription: string,
  currentResume: string,
  mode: GenerationMode = 'full',
  signal?: AbortSignal,
  onProgress?: ProgressCallback,
): Promise<GenerationResult> {
  if (!settings.apiKey) {
    throw new Error('Add your Gemini API key in Settings first.')
  }

  if (mode === 'fit-only') {
    onProgress?.('Analyzing interview fit…')
    const { analysis, usage } = await generateAnalysisStep(
      settings,
      jobDescription,
      currentResume,
      'fit-only',
      signal,
    )
    return { mode: 'fit-only', resume: null, analysis, usage }
  }

  // Full mode: two smaller calls — resume first, then score the tailored version.
  onProgress?.('Step 1 of 2 — Tailoring your resume…')
  const { resume, usage: resumeUsage } = await generateResumeStep(
    settings,
    jobDescription,
    currentResume,
    signal,
  )

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  onProgress?.('Step 2 of 2 — Scoring interview fit…')
  const summaryText = resumeToAnalysisSummary(resume)
  const { analysis, usage: analysisUsage } = await generateAnalysisStep(
    settings,
    jobDescription,
    summaryText,
    'tailored-analysis',
    signal,
  )

  return {
    mode: 'full',
    resume,
    analysis,
    usage: mergeUsage(resumeUsage, analysisUsage),
  }
}

function humanizeError(status: number, message: string): string {
  if (status === 400 && /api key not valid/i.test(message)) {
    return 'Your Gemini API key is not valid. Double-check it in Settings.'
  }
  if (status === 403) {
    return 'Access denied (403). Your API key may lack permission or the Generative Language API is not enabled for it.'
  }
  if (status === 429) {
    return 'Rate limit / quota exceeded (429). Wait a moment, or switch to a lighter model in Settings.'
  }
  if (status === 404) {
    return `Model not found (404). The selected model may be unavailable for your key. ${message}`
  }
  return message
}
