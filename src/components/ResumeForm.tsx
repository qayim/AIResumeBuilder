import { SparklesIcon } from './icons'

interface Props {
  jobDescription: string
  currentResume: string
  loading: boolean
  hasApiKey: boolean
  onJobDescriptionChange: (v: string) => void
  onCurrentResumeChange: (v: string) => void
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
  loading,
  hasApiKey,
  onJobDescriptionChange,
  onCurrentResumeChange,
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

      <div className="mt-5 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          Tip: paste as much detail as possible. Nothing is invented — the AI only re-emphasizes what's
          truly in your resume.
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
              {loading ? 'Tailoring…' : 'Tailor my resume'}
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
          Add more detail to both fields (at least a few sentences each) to enable tailoring.
        </p>
      ) : null}
    </div>
  )
}
