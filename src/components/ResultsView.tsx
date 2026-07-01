import { useState } from 'react'
import type { GenerationResult, TailoredResume } from '../types'
import { formatCostUsd } from '../lib/pricing'
import ChanceGauge from './ChanceGauge'
import { CheckIcon, CopyIcon, DownloadIcon } from './icons'

interface Props {
  result: GenerationResult
  downloading: boolean
  onDownload: () => void
}

function resumeToPlainText(r: TailoredResume): string {
  const lines: string[] = []
  const c = r.contact
  lines.push(c.fullName)
  if (c.title) lines.push(c.title)
  lines.push([c.email, c.phone, c.location, ...(c.links ?? [])].filter(Boolean).join(' | '))
  if (r.summary) lines.push('', 'SUMMARY', r.summary)
  if (r.skills?.length) {
    lines.push('', 'SKILLS')
    for (const g of r.skills) lines.push(`${g.category}: ${g.skills.join(', ')}`)
  }
  if (r.experience?.length) {
    lines.push('', 'EXPERIENCE')
    for (const e of r.experience) {
      lines.push(`${e.role} — ${e.company}, ${e.location} (${e.startDate} – ${e.endDate})`)
      for (const b of e.bullets ?? []) lines.push(`  • ${b}`)
    }
  }
  if (r.projects?.length) {
    lines.push('', 'PROJECTS')
    for (const p of r.projects) lines.push(`${p.name}: ${p.description}`)
  }
  if (r.education?.length) {
    lines.push('', 'EDUCATION')
    for (const e of r.education) {
      lines.push(`${e.degree} — ${e.institution}, ${e.location} (${e.startDate} – ${e.endDate})`)
      for (const d of e.details ?? []) lines.push(`  • ${d}`)
    }
  }
  if (r.certifications?.length) {
    lines.push('', 'CERTIFICATIONS')
    for (const cert of r.certifications) lines.push(`  • ${cert}`)
  }
  return lines.join('\n')
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h4 className="mb-1.5 border-b border-brand-200 pb-1 text-xs font-bold uppercase tracking-wide text-brand-700">
        {title}
      </h4>
      {children}
    </div>
  )
}

function ResumePreview({ resume }: { resume: TailoredResume }) {
  const c = resume.contact
  const contactBits = [c.email, c.phone, c.location, ...(c.links ?? [])].filter(Boolean)
  return (
    <div className="rounded-lg bg-white p-6 text-[13px] leading-relaxed text-slate-800 shadow-inner ring-1 ring-slate-200">
      <div className="mb-4 text-center">
        <h3 className="text-xl font-extrabold text-slate-900">{c.fullName || 'Your Name'}</h3>
        {c.title ? <p className="text-sm text-slate-500">{c.title}</p> : null}
        {contactBits.length ? (
          <p className="mt-1 text-xs text-slate-500">{contactBits.join('  •  ')}</p>
        ) : null}
      </div>

      {resume.summary ? (
        <Section title="Summary">
          <p>{resume.summary}</p>
        </Section>
      ) : null}

      {resume.skills?.length ? (
        <Section title="Skills">
          {resume.skills.map((g) => (
            <p key={g.category}>
              <span className="font-semibold">{g.category}:</span> {g.skills.join(', ')}
            </p>
          ))}
        </Section>
      ) : null}

      {resume.experience?.length ? (
        <Section title="Experience">
          {resume.experience.map((e, i) => (
            <div key={i} className="mb-3">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{e.role}</span>
                <span className="text-xs text-slate-500">
                  {[e.startDate, e.endDate].filter(Boolean).join(' – ')}
                </span>
              </div>
              <p className="text-xs italic text-slate-500">
                {[e.company, e.location].filter(Boolean).join(' — ')}
              </p>
              <ul className="ml-4 mt-1 list-disc space-y-0.5">
                {(e.bullets ?? []).map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </Section>
      ) : null}

      {resume.projects?.length ? (
        <Section title="Projects">
          {resume.projects.map((p, i) => (
            <p key={i}>
              <span className="font-semibold">{p.name}:</span> {p.description}
            </p>
          ))}
        </Section>
      ) : null}

      {resume.education?.length ? (
        <Section title="Education">
          {resume.education.map((e, i) => (
            <div key={i} className="mb-2">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{e.degree}</span>
                <span className="text-xs text-slate-500">
                  {[e.startDate, e.endDate].filter(Boolean).join(' – ')}
                </span>
              </div>
              <p className="text-xs italic text-slate-500">
                {[e.institution, e.location].filter(Boolean).join(' — ')}
              </p>
            </div>
          ))}
        </Section>
      ) : null}

      {resume.certifications?.length ? (
        <Section title="Certifications">
          <ul className="ml-4 list-disc space-y-0.5">
            {resume.certifications.map((c2, i) => (
              <li key={i}>{c2}</li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  )
}

function KeywordChips({ items, tone }: { items: string[]; tone: 'good' | 'bad' }) {
  if (!items?.length) return <p className="text-xs text-slate-400">None</p>
  const cls =
    tone === 'good'
      ? 'bg-green-50 text-green-700 ring-green-200'
      : 'bg-rose-50 text-rose-700 ring-rose-200'
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((k, i) => (
        <span key={i} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${cls}`}>
          {k}
        </span>
      ))}
    </div>
  )
}

export default function ResultsView({ result, downloading, onDownload }: Props) {
  const { resume, analysis, usage, mode } = result
  const [copied, setCopied] = useState(false)
  const isFitOnly = mode === 'fit-only'

  const copyText = async () => {
    if (!resume) return
    await navigator.clipboard.writeText(resumeToPlainText(resume))
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const analysisPanel = (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Interview chance</h3>
          {isFitOnly ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
              Fit check only
            </span>
          ) : null}
        </div>
        <ChanceGauge value={analysis.interviewChance} verdict={analysis.verdict} />
        <p className="mt-4 text-sm leading-relaxed text-slate-600">{analysis.reasoning}</p>
        <p className="mt-3 text-xs text-slate-400">
          {analysis.jobTitle} at {analysis.company}
        </p>
      </div>

      <div className="card p-5">
        <h3 className="mb-2 text-sm font-semibold text-green-700">Matched keywords</h3>
        <KeywordChips items={analysis.matchedKeywords} tone="good" />
        <h3 className="mb-2 mt-4 text-sm font-semibold text-rose-700">Missing / weak keywords</h3>
        <KeywordChips items={analysis.missingKeywords} tone="bad" />
      </div>

      {analysis.suggestions?.length ? (
        <div className="card p-5">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Suggestions to improve</h3>
          <ul className="space-y-1.5">
            {analysis.suggestions.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-600">
                <CheckIcon width={15} height={15} className="mt-0.5 flex-none text-brand-500" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="card p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Token usage (this request)
        </h3>
        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          <div className="rounded-lg bg-slate-50 py-2">
            <p className="text-base font-bold text-slate-800">{usage.promptTokens.toLocaleString()}</p>
            <p className="text-[11px] text-slate-500">Input</p>
          </div>
          <div className="rounded-lg bg-slate-50 py-2">
            <p className="text-base font-bold text-slate-800">{usage.outputTokens.toLocaleString()}</p>
            <p className="text-[11px] text-slate-500">Output</p>
          </div>
          <div className="rounded-lg bg-brand-50 py-2">
            <p className="text-base font-bold text-brand-700">{usage.totalTokens.toLocaleString()}</p>
            <p className="text-[11px] text-slate-500">Total</p>
          </div>
          <div className="rounded-lg bg-emerald-50 py-2">
            <p className="text-base font-bold text-emerald-700">{formatCostUsd(usage.estimatedCostUsd)}</p>
            <p className="text-[11px] text-slate-500">Est. cost</p>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-slate-400">
          Cost is estimated from published Gemini pricing. Free-tier keys may not be billed.
        </p>
      </div>
    </div>
  )

  if (isFitOnly) {
    return <div className="max-w-xl animate-fade-in">{analysisPanel}</div>
  }

  return (
    <div className="grid animate-fade-in gap-5 lg:grid-cols-[360px_1fr]">
      {analysisPanel}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Tailored resume preview</h3>
          {resume ? (
            <div className="flex gap-2">
              <button className="btn-secondary !py-2 !text-xs" onClick={copyText}>
                {copied ? <CheckIcon width={14} height={14} /> : <CopyIcon width={14} height={14} />}
                {copied ? 'Copied' : 'Copy text'}
              </button>
              <button className="btn-primary !py-2 !text-xs" onClick={onDownload} disabled={downloading}>
                <DownloadIcon width={14} height={14} />
                {downloading ? 'Preparing…' : 'Download .docx'}
              </button>
            </div>
          ) : null}
        </div>
        {resume ? <ResumePreview resume={resume} /> : null}
      </div>
    </div>
  )
}
