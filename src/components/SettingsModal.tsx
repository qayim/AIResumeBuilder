import { useEffect, useState } from 'react'
import type { Settings } from '../types'
import { AVAILABLE_MODELS } from '../lib/gemini'
import { DEFAULT_SETTINGS } from '../lib/storage'
import ApiKeyGuide from './ApiKeyGuide'
import { CloseIcon, KeyIcon } from './icons'

interface Props {
  open: boolean
  settings: Settings
  onClose: () => void
  onSave: (settings: Settings) => void
}

export default function SettingsModal({ open, settings, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<Settings>(settings)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    if (open) {
      setDraft(settings)
      setShowKey(false)
    }
  }, [open, settings])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="card my-8 w-full max-w-lg animate-fade-in">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <KeyIcon className="text-brand-600" /> Gemini settings
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close settings"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div>
            <label className="field-label" htmlFor="apiKey">
              Gemini API key
            </label>
            <div className="relative">
              <input
                id="apiKey"
                type={showKey ? 'text' : 'password'}
                className="field-input pr-16"
                placeholder="AIza..."
                autoComplete="off"
                spellCheck={false}
                value={draft.apiKey}
                onChange={(e) => update('apiKey', e.target.value.trim())}
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute inset-y-0 right-2 my-auto h-7 rounded-md px-2 text-xs font-medium text-brand-600 hover:bg-brand-50"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Stored only in your browser. Sent directly to Google's API, never to any other server.
            </p>
          </div>

          <div>
            <label className="field-label" htmlFor="model">
              Model
            </label>
            <select
              id="model"
              className="field-input"
              value={draft.model}
              onChange={(e) => update('model', e.target.value)}
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="field-label mb-0" htmlFor="maxTokens">
                Max output tokens
              </label>
              <span className="text-sm font-semibold text-brand-700">{draft.maxOutputTokens}</span>
            </div>
            <input
              id="maxTokens"
              type="range"
              min={1024}
              max={32768}
              step={1024}
              value={draft.maxOutputTokens}
              onChange={(e) => update('maxOutputTokens', Number(e.target.value))}
              className="mt-2 w-full accent-brand-600"
            />
            <p className="mt-1 text-xs text-slate-500">
              Caps how much the model can write per request. Higher = longer resumes allowed, but more
              tokens billed. ~8k is plenty for most resumes.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="field-label mb-0" htmlFor="temp">
                Creativity (temperature)
              </label>
              <span className="text-sm font-semibold text-brand-700">
                {draft.temperature.toFixed(1)}
              </span>
            </div>
            <input
              id="temp"
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={draft.temperature}
              onChange={(e) => update('temperature', Number(e.target.value))}
              className="mt-2 w-full accent-brand-600"
            />
            <p className="mt-1 text-xs text-slate-500">
              Lower = more factual and consistent (recommended for resumes). Higher = more varied
              wording.
            </p>
          </div>

          <ApiKeyGuide />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
          <button
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
            onClick={() => setDraft({ ...DEFAULT_SETTINGS, apiKey: draft.apiKey })}
          >
            Reset to defaults
          </button>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary" onClick={() => onSave(draft)}>
              Save settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
