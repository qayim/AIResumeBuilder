import type { ResumeLength } from '../types'
import { SparklesIcon } from './icons'

interface Props {
  jobDescription: string
  currentResume: string
  fitOnly: boolean
  resumeLength: ResumeLength
  loading: boolean
  hasApiKey: boolean
  onJobDescriptionChange: (v: string) => void
  onCurrentResumeChange: (v: string) => void
  onFitOnlyChange: (v: boolean) => void
  onResumeLengthChange: (v: ResumeLength) => void
  onGenerate: () => void
  onCancel: () => void
  onOpenSettings: () => void
}

function wordCount(text: string): number {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

export default function ResumeForm({
  jobDescription,
  currentResume,
  fitOnly,
  resumeLength,
  loading,
  hasApiKey,
  onJobDescriptionChange,
  onCurrentResumeChange,
  onFitOnlyChange,
  onResumeLengthChange,
  onGenerate,
  onCancel,
  onOpenSettings,
}: Props) {
  const canGenerate = jobDescription.trim().length > 30 && currentResume.trim().length > 30

  return (
    <div className="card p-5 sm:p-6">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col">
          <div className="mb-1.5 flex items-baseline justify-between">
            <label className="field-label mb-0" htmlFor="jd">
              Job description
            </label>
            <span className="text-xs text-slate-400">{wordCount(jobDescription)} words</span>
          </div>
          <textarea
            id="jd"
            className="field-input min-h-[300px] flex-1 resize-y font-mono text-[13px] leading-relaxed"
            placeholder="Paste the full job posting here — responsibilities, requirements, qualifications, tech stack..."
            value={jobDescription}
            onChange={(e) => onJobDescriptionChange(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="flex flex-col">
          <div className="mb-1.5 flex items-baseline justify-between">
            <label className="field-label mb-0" htmlFor="resume">
              Your current resume
            </label>
            <span className="text-xs text-slate-400">{wordCount(currentResume)} words</span>
          </div>
          <textarea
            id="resume"
            className="field-input min-h-[300px] flex-1 resize-y font-mono text-[13px] leading-relaxed"
            placeholder="Paste your existing resume as plain text — contact info, summary, experience, skills, education..."
            value={currentResume}
            onChange={(e) => onCurrentResumeChange(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-800">Fit check only</p>
          <p className="text-xs text-slate-500">
            Skip resume rewriting — only score interview fit and keywords. Uses fewer tokens.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={fitOnly}
          aria-label="Fit check only mode"
          disabled={loading}
          onClick={() => onFitOnlyChange(!fitOnly)}
          className={`relative h-7 w-12 flex-none rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 disabled:opacity-50 ${
            fitOnly ? 'bg-brand-600' : 'bg-slate-300'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
              fitOnly ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {!fitOnly ? (
        <div className="mt-4">
          <p className="field-label">Tailored resume length</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => onResumeLengthChange('one-page')}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                resumeLength === 'one-page'
                  ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">1 page</p>
              <p className="text-xs text-slate-500">Concise, ATS-friendly (default)</p>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => onResumeLengthChange('multi-page')}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                resumeLength === 'multi-page'
                  ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">2–3 pages</p>
              <p className="text-xs text-slate-500">Detailed, all experience included</p>
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            You also get an <strong>ideal resume</strong> — the best possible version for this job using
            only your real qualifications.
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          {fitOnly
            ? 'Fit-only mode analyzes your current resume as-is — no .docx download.'
            : 'Nothing is invented — the AI only re-emphasizes what\'s truly in your resume.'}
        </p>
        <div className="flex items-center gap-2">
          {loading ? (
            <button className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
          {hasApiKey ? (
            <button className="btn-primary" onClick={onGenerate} disabled={!canGenerate || loading}>
              <SparklesIcon width={16} height={16} />
              {loading
                ? fitOnly
                  ? 'Checking fit…'
                  : 'Tailoring…'
                : fitOnly
                  ? 'Check interview fit'
                  : 'Tailor my resume'}
            </button>
          ) : (
            <button className="btn-primary" onClick={onOpenSettings}>
              Add API key to start
            </button>
          )}
        </div>
      </div>
      {!canGenerate && (jobDescription || currentResume) ? (
        <p className="mt-2 text-right text-xs text-amber-600">
          Add more detail to both fields (at least a few sentences each) to continue.
        </p>
      ) : null}
    </div>
  )
}
