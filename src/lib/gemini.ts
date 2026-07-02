import type {
  GenerationMode,
  GenerationResult,
  InterviewAnalysis,
  ResumeLength,
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

const RESUME_BASE_RULES = `- NEVER invent experience, employers, dates, degrees, or skills the candidate does not have.
- Mirror job-description keywords where the candidate genuinely qualifies.
- Use strong action verbs; quantify impact when numbers exist in the original.
- Include projects and certifications only if present in the original resume.
- If a field is unknown, use an empty string or empty array.`

const ONE_PAGE_RULES = `${RESUME_BASE_RULES}
- Target ONE page when printed (~400-500 words of content).
- Summary: 2-3 sentences (under 70 words).
- Max 4 bullet points per experience entry; each bullet under 25 words.
- Max 3 skill categories; prioritize JD-relevant skills.
- Include only the most relevant 3-4 experience entries if the resume is long.`

const MULTI_PAGE_RULES = `${RESUME_BASE_RULES}
- Target TWO to THREE pages when printed — comprehensive but focused.
- Summary: 4-6 sentences covering career arc and fit for this role.
- Max 7 bullet points per experience entry; expand with metrics and context.
- Up to 6 skill categories; include all genuinely relevant skills from the original.
- Include ALL experience, education, projects, and certifications from the original resume.
- Add detail to each role — do not omit jobs unless clearly irrelevant to the JD.`

const IDEAL_RESUME_RULES = `${RESUME_BASE_RULES}
- Create the IDEAL resume for THIS job — how this candidate should present their REAL background to maximize fit.
- Use every qualification from the original resume that maps to the job description; omit nothing relevant.
- Structure sections in the order and language the JD implies (mirror must-have keywords throughout).
- Summary: compelling 4-5 sentence pitch directly addressing the role's top requirements.
- Max 7 bullets per role; each bullet should tie achievements to JD requirements where honest.
- This is a benchmark "gold standard" version — still 100% truthful, but maximally optimized for the role.
- Target 1-2 pages of dense, high-impact content.`

const PERFECT_RESUME_RULES = `- Start from the candidate's existing resume and the job description.
- Build the resume of the PERFECT CANDIDATE for this role — someone who meets every major JD requirement.
- KEEP all real contact info, employers, dates, and education from the original resume.
- ADD every skill, tool, technology, certification, and keyword from the JD that is missing from the resume.
- ADD new experience bullets to existing roles (or new project entries) that cover JD gaps — write them as if the candidate possesses those qualifications.
- EXPAND the skills section until it covers 100% of JD must-haves and nice-to-haves.
- REFRAME the summary to position the candidate as an exact match for the role.
- Mirror the job description's language and keyword priorities throughout.
- Max 8 bullet points per role where needed to cover JD requirements.
- Include certifications and projects that satisfy JD requirements, adding any missing ones plausibly.
- This is an aspirational "perfect match" profile — complete the resume so it fully satisfies the job posting.
- Target 1-2 pages of comprehensive, keyword-rich content.`

type ResumeVariant = 'tailored-one-page' | 'tailored-multi-page' | 'ideal' | 'perfect'

type RequestKind = 'fit-only' | 'resume-only' | 'tailored-analysis'

function resumeInstruction(variant: ResumeVariant, concise: boolean): string {
  const rules =
    variant === 'perfect'
      ? PERFECT_RESUME_RULES
      : variant === 'ideal'
        ? IDEAL_RESUME_RULES
        : variant === 'tailored-multi-page'
          ? MULTI_PAGE_RULES
          : ONE_PAGE_RULES

  const intro =
    variant === 'perfect'
      ? `You are an expert resume writer. Produce the PERFECT CANDIDATE resume for the job — start from the candidate's resume and ADD everything missing from the JD to create a complete match. Return ONLY the resume as JSON.`
      : variant === 'ideal'
        ? `You are an expert resume writer. Produce the IDEAL resume for the job description using ONLY the candidate's real qualifications. Return ONLY the resume as JSON.`
        : `You are an expert resume writer specializing in ATS-optimized resumes. Rewrite the candidate's resume tailored to the job description. Return ONLY the tailored resume as JSON.`

  const conciseNote = concise
    ? '\n\nIMPORTANT: Prior pass was too long. Be extra concise — fewer bullets and a shorter summary.'
    : ''

  return `${intro}

${rules}
${conciseNote}

Respond ONLY with JSON conforming to the schema.`
}

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
  resumeVariant?: ResumeVariant,
): string {
  const base = buildInputs(jobDescription, resumeText)

  if (kind === 'fit-only') {
    return `${base}

Analyze fit between this resume and job description. Return interview analysis JSON only.`
  }

  if (kind === 'resume-only') {
    if (resumeVariant === 'perfect') {
      return `${base}

Produce the PERFECT CANDIDATE resume: start from the candidate's resume and ADD all missing JD requirements to create a complete match. Return resume JSON only.`
    }
    if (resumeVariant === 'ideal') {
      return `${base}

Produce the IDEAL resume for this job using only the candidate's real qualifications. Return resume JSON only.`
    }
    if (resumeVariant === 'tailored-multi-page') {
      return `${base}

Produce a detailed 2-3 page tailored resume as JSON only.`
    }
    return `${base}

Produce a concise 1-page tailored resume as JSON only.`
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
    estimatedCostMyr: estimateTokenCost(model, promptTokens, outputTokens),
  }
}

function mergeUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    estimatedCostMyr: a.estimatedCostMyr + b.estimatedCostMyr,
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

function coerceResume(value: unknown, variant: ResumeVariant = 'tailored-one-page'): TailoredResume {
  if (!isRecord(value)) return emptyResume()

  const isCompact = variant === 'tailored-one-page'
  const maxBullets = isCompact ? 4 : 8
  const maxSkills = isCompact ? 4 : 10
  const maxProjects = isCompact ? 5 : 12

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
    skills: Array.isArray(value.skills)
      ? (value.skills as TailoredResume['skills']).slice(0, maxSkills)
      : [],
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
      ? (value.projects as TailoredResume['projects']).slice(0, maxProjects)
      : [],
  }

  trimBullets(resume.experience, maxBullets)
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

function parseResumeResponse(
  text: string,
  finishReason: string | undefined,
  variant: ResumeVariant = 'tailored-one-page',
): TailoredResume {
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
  return coerceResume(source, variant)
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
  resumeVariant: ResumeVariant = 'tailored-one-page',
): Record<string, unknown> {
  const instructions: Record<RequestKind, string> = {
    'fit-only': concise
      ? `${FIT_ONLY_INSTRUCTION}\n\nBe extremely brief — half the normal length.`
      : FIT_ONLY_INSTRUCTION,
    'resume-only': resumeInstruction(resumeVariant, concise),
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
  resumeVariant: ResumeVariant = 'tailored-one-page',
): Promise<{ raw: unknown; text: string; finishReason?: string }> {
  const body = requestBody(
    settings,
    kind,
    buildPrompt(jobDescription, resumeText, kind, resumeVariant),
    maxOutputTokens,
    concise,
    resumeVariant,
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

function toResumeVariant(length: ResumeLength): ResumeVariant {
  return length === 'multi-page' ? 'tailored-multi-page' : 'tailored-one-page'
}

async function generateResumeStep(
  settings: Settings,
  jobDescription: string,
  currentResume: string,
  variant: ResumeVariant,
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
      variant,
    )

    try {
      const resume = parseResumeResponse(text, finishReason, variant)
      if (finishReason === 'MAX_TOKENS' && attempt === 0) continue
      return { resume, usage: extractUsage(raw, settings.model) }
    } catch (err) {
      if (attempt === 1 || finishReason !== 'MAX_TOKENS') throw err
    }
  }

  const hint =
    variant === 'tailored-one-page'
      ? 'Try 2-3 pages length, shorten your input, or use Fit check only mode.'
      : 'Try 1 page length, shorten your input, or use Fit check only mode.'

  throw new Error(`Could not generate a complete resume within token limits. ${hint}`)
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
    estimatedCostMyr: 0,
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
  resumeLength: ResumeLength = 'one-page',
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
    return {
      mode: 'fit-only',
      resumeLength,
      resume: null,
      idealResume: null,
      perfectResume: null,
      analysis,
      usage,
    }
  }

  const tailoredVariant = toResumeVariant(resumeLength)

  onProgress?.('Step 1 of 4 — Tailoring your resume…')
  const { resume, usage: resumeUsage } = await generateResumeStep(
    settings,
    jobDescription,
    currentResume,
    tailoredVariant,
    signal,
  )

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  onProgress?.('Step 2 of 4 — Building ideal resume for this role…')
  const { resume: idealResume, usage: idealUsage } = await generateResumeStep(
    settings,
    jobDescription,
    currentResume,
    'ideal',
    signal,
  )

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  onProgress?.('Step 3 of 4 — Building perfect candidate resume…')
  const { resume: perfectResume, usage: perfectUsage } = await generateResumeStep(
    settings,
    jobDescription,
    currentResume,
    'perfect',
    signal,
  )

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  onProgress?.('Step 4 of 4 — Scoring interview fit…')
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
    resumeLength,
    resume,
    idealResume,
    perfectResume,
    analysis,
    usage: mergeUsage(
      mergeUsage(mergeUsage(resumeUsage, idealUsage), perfectUsage),
      analysisUsage,
    ),
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
