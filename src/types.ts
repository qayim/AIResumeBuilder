export interface Settings {
  apiKey: string
  model: string
  maxOutputTokens: number
  temperature: number
}

export interface ContactInfo {
  fullName: string
  title: string
  email: string
  phone: string
  location: string
  links: string[]
}

export interface ExperienceEntry {
  company: string
  role: string
  location: string
  startDate: string
  endDate: string
  bullets: string[]
}

export interface EducationEntry {
  institution: string
  degree: string
  location: string
  startDate: string
  endDate: string
  details: string[]
}

export interface SkillGroup {
  category: string
  skills: string[]
}

export interface TailoredResume {
  contact: ContactInfo
  summary: string
  skills: SkillGroup[]
  experience: ExperienceEntry[]
  education: EducationEntry[]
  certifications: string[]
  projects: { name: string; description: string }[]
}

export interface InterviewAnalysis {
  /** 0-100 estimated probability of landing an interview. */
  interviewChance: number
  /** Short verdict label, e.g. "Strong match". */
  verdict: string
  /** Job title extracted from the job description (for file naming). */
  jobTitle: string
  /** Company name extracted from the job description (for file naming). */
  company: string
  /** Keywords from the job description already present in the resume. */
  matchedKeywords: string[]
  /** Important keywords from the job description still missing from the resume. */
  missingKeywords: string[]
  /** Concrete suggestions to further improve the resume. */
  suggestions: string[]
  /** One-paragraph explanation of the score. */
  reasoning: string
}

export interface TokenUsage {
  promptTokens: number
  outputTokens: number
  totalTokens: number
  /** Estimated API cost in MYR for this request. */
  estimatedCostMyr: number
}

export type GenerationMode = 'full' | 'fit-only'

/** Target length for the tailored resume output. */
export type ResumeLength = 'one-page' | 'multi-page'

export interface GenerationResult {
  mode: GenerationMode
  resumeLength: ResumeLength
  /** Candidate's resume tailored to the job at the chosen length. */
  resume: TailoredResume | null
  /** Best possible resume for the role using only the candidate's real qualifications. */
  idealResume: TailoredResume | null
  /** Aspirational resume that adds missing JD requirements to model a perfect candidate. */
  perfectResume: TailoredResume | null
  analysis: InterviewAnalysis
  usage: TokenUsage
}
