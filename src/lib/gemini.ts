import type {
  GenerationResult,
  InterviewAnalysis,
  Settings,
  TailoredResume,
  TokenUsage,
} from '../types'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

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

const responseSchema = {
  type: 'OBJECT',
  properties: {
    resume: {
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
          required: ['fullName', 'title', 'email', 'phone', 'location', 'links'],
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
            required: ['company', 'role', 'location', 'startDate', 'endDate', 'bullets'],
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
            required: ['institution', 'degree', 'location', 'startDate', 'endDate', 'details'],
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
            required: ['name', 'description'],
          },
        },
      },
      required: [
        'contact',
        'summary',
        'skills',
        'experience',
        'education',
        'certifications',
        'projects',
      ],
    },
    analysis: {
      type: 'OBJECT',
      properties: {
        interviewChance: { type: 'INTEGER' },
        verdict: { type: 'STRING' },
        matchedKeywords: stringArray,
        missingKeywords: stringArray,
        suggestions: stringArray,
        reasoning: { type: 'STRING' },
      },
      required: [
        'interviewChance',
        'verdict',
        'matchedKeywords',
        'missingKeywords',
        'suggestions',
        'reasoning',
      ],
    },
  },
  required: ['resume', 'analysis'],
}

const SYSTEM_INSTRUCTION = `You are an expert technical recruiter and professional resume writer with deep knowledge of Applicant Tracking Systems (ATS).

Your task:
1. Rewrite the candidate's resume so it is tailored to the provided job description.
2. Estimate the candidate's realistic chance (0-100) of landing an interview WITH the tailored resume.

Strict rules for tailoring:
- NEVER invent experience, employers, dates, degrees, or skills the candidate does not have. Only rephrase, reorder, and emphasize what is genuinely supported by the original resume.
- Mirror the language and keywords of the job description where the candidate genuinely qualifies, to maximize ATS keyword matching.
- Write achievement-oriented bullet points starting with strong action verbs; quantify impact when the original resume provides numbers.
- Keep the summary concise (2-4 sentences) and targeted at the role.
- Group skills into sensible categories and prioritize skills relevant to the job description.
- If a field is unknown, use an empty string or empty array rather than guessing.

Scoring rules for analysis.interviewChance:
- Base the score on genuine overlap between the candidate's real qualifications and the job's hard requirements (years of experience, must-have skills, seniority, domain).
- Be realistic and calibrated, not flattering. A weak match should score low.
- matchedKeywords: important job-description keywords that ARE supported by the resume.
- missingKeywords: important job-description keywords the candidate is missing or weak on.
- suggestions: concrete, honest actions the candidate could take to improve their odds.

Respond ONLY with JSON that conforms to the provided schema.`

export interface GeminiError extends Error {
  status?: number
}

function buildPrompt(jobDescription: string, currentResume: string): string {
  return `JOB DESCRIPTION:
"""
${jobDescription.trim()}
"""

CANDIDATE'S CURRENT RESUME:
"""
${currentResume.trim()}
"""

Produce the tailored resume and interview analysis as JSON.`
}

function extractUsage(raw: unknown): TokenUsage {
  const meta = (raw as { usageMetadata?: Record<string, number> })?.usageMetadata ?? {}
  return {
    promptTokens: meta.promptTokenCount ?? 0,
    outputTokens: meta.candidatesTokenCount ?? 0,
    totalTokens: meta.totalTokenCount ?? 0,
  }
}

function extractText(raw: unknown): string {
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
  const parts = candidate?.content?.parts ?? []
  const text = parts.map((p) => p.text ?? '').join('')

  if (!text) {
    if (candidate?.finishReason === 'MAX_TOKENS') {
      throw new Error(
        'Gemini hit the max output token limit before finishing. Increase "Max output tokens" in Settings and try again.',
      )
    }
    throw new Error('Gemini returned an empty response. Try again or switch models.')
  }
  return text
}

export async function generateTailoredResume(
  settings: Settings,
  jobDescription: string,
  currentResume: string,
  signal?: AbortSignal,
): Promise<GenerationResult> {
  if (!settings.apiKey) {
    throw new Error('Add your Gemini API key in Settings first.')
  }

  const url = `${API_BASE}/${encodeURIComponent(settings.model)}:generateContent?key=${encodeURIComponent(
    settings.apiKey,
  )}`

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: buildPrompt(jobDescription, currentResume) }] }],
    generationConfig: {
      temperature: settings.temperature,
      maxOutputTokens: settings.maxOutputTokens,
      responseMimeType: 'application/json',
      responseSchema,
    },
  }

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

  const text = extractText(raw)
  const usage = extractUsage(raw)

  let parsed: { resume: TailoredResume; analysis: InterviewAnalysis }
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Gemini returned malformed JSON. Try again or lower the temperature in Settings.')
  }

  parsed.analysis.interviewChance = Math.max(
    0,
    Math.min(100, Math.round(parsed.analysis.interviewChance ?? 0)),
  )

  return { resume: parsed.resume, analysis: parsed.analysis, usage }
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
