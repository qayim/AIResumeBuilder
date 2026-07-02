import { useEffect, useRef, useState } from 'react'
import type { GenerationMode, GenerationResult, ResumeLength, Settings } from './types'
import { loadSettings, saveSettings } from './lib/storage'
import { AVAILABLE_MODELS, generateTailoredResume } from './lib/gemini'
import { downloadResumeDocx } from './lib/docx'
import SettingsModal from './components/SettingsModal'
import ResumeForm from './components/ResumeForm'
import ResultsView from './components/ResultsView'
import { AlertIcon, SettingsIcon, SparklesIcon } from './components/icons'

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [jobDescription, setJobDescription] = useState('')
  const [currentResume, setCurrentResume] = useState('')
  const [fitOnly, setFitOnly] = useState(false)
  const [resumeLength, setResumeLength] = useState<ResumeLength>('one-page')
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [downloading, setDownloading] = useState<'tailored' | 'ideal' | 'perfect' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!settings.apiKey) setSettingsOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSaveSettings = (next: Settings) => {
    setSettings(next)
    saveSettings(next)
    setSettingsOpen(false)
  }

  const handleGenerate = async () => {
    setError(null)
    setResult(null)
    setLoading(true)
    setLoadingMessage(fitOnly ? 'Analyzing interview fit…' : 'Step 1 of 4 — Tailoring your resume…')
    const controller = new AbortController()
    abortRef.current = controller
    const mode: GenerationMode = fitOnly ? 'fit-only' : 'full'
    try {
      const res = await generateTailoredResume(
        settings,
        jobDescription,
        currentResume,
        mode,
        resumeLength,
        controller.signal,
        setLoadingMessage,
      )
      setResult(res)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message)
      }
    } finally {
      setLoading(false)
      setLoadingMessage('')
      abortRef.current = null
    }
  }

  const handleCancel = () => abortRef.current?.abort()

  const handleDownload = async (which: 'tailored' | 'ideal' | 'perfect') => {
    if (!result) return
    const resume =
      which === 'perfect'
        ? result.perfectResume
        : which === 'ideal'
          ? result.idealResume
          : result.resume
    if (!resume) return
    setDownloading(which)
    try {
      const label =
        which === 'perfect' ? 'Perfect_Resume' : which === 'ideal' ? 'Ideal_Resume' : 'Resume'
      await downloadResumeDocx(resume, result.analysis.jobTitle, result.analysis.company, label)
    } catch {
      setError('Failed to generate the .docx file. Please try again.')
    } finally {
      setDownloading(null)
    }
  }

  const modelLabel =
    AVAILABLE_MODELS.find((m) => m.id === settings.model)?.label ?? settings.model

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <SparklesIcon width={20} height={20} />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight text-slate-900">ResumeTailor</h1>
              <p className="text-xs text-slate-500">AI resume builder · powered by Gemini</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 sm:inline">
              {modelLabel}
            </span>
            <button className="btn-secondary !py-2" onClick={() => setSettingsOpen(true)}>
              <SettingsIcon width={16} height={16} />
              Settings
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Tailor your resume to any job in seconds
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Paste a job description and your current resume. Get a tailored resume (1 page or 2–3 pages),
            an ideal benchmark version, a perfect-candidate version that fills JD gaps, interview-chance
            scoring, and <code>.docx</code> downloads.
          </p>
        </div>

        {error ? (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <AlertIcon className="mt-0.5 flex-none text-rose-500" />
            <div className="flex-1">
              <p className="font-semibold">Something went wrong</p>
              <p>{error}</p>
            </div>
            <button
              className="text-rose-400 hover:text-rose-600"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        ) : null}

        <div className="space-y-6">
          <ResumeForm
            jobDescription={jobDescription}
            currentResume={currentResume}
            fitOnly={fitOnly}
            resumeLength={resumeLength}
            loading={loading}
            hasApiKey={Boolean(settings.apiKey)}
            onJobDescriptionChange={setJobDescription}
            onCurrentResumeChange={setCurrentResume}
            onFitOnlyChange={setFitOnly}
            onResumeLengthChange={setResumeLength}
            onGenerate={handleGenerate}
            onCancel={handleCancel}
            onOpenSettings={() => setSettingsOpen(true)}
          />

          {loading && !result ? (
            <div className="card flex flex-col items-center justify-center gap-3 p-12 text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
              <p className="text-sm font-medium text-slate-700">
                {loadingMessage || (fitOnly
                  ? 'Gemini is analyzing your fit for this role…'
                  : 'Gemini is building your resumes and scoring your match…')}
              </p>
              <p className="text-xs text-slate-400">
                {fitOnly ? 'This usually takes 5–15 seconds.' : 'Four steps — usually 25–50 seconds.'}
              </p>
            </div>
          ) : null}

          {result ? (
            <ResultsView
              result={result}
              downloading={downloading}
              onDownload={handleDownload}
            />
          ) : null}
        </div>

        <footer className="mt-12 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
          <p>
            Your API key and inputs stay in your browser. Requests go directly to Google's Gemini API.
          </p>
          <p className="mt-1">
            Built with React, Vite &amp; the <code>docx</code> library. Be honest in your inputs — the
            score reflects your real fit.
          </p>
        </footer>
      </main>

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
    </div>
  )
}
