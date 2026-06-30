import type { Settings } from '../types'

const STORAGE_KEY = 'resume-tailor-settings'

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'gemini-2.0-flash',
  maxOutputTokens: 8192,
  temperature: 0.4,
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Ignore write failures (e.g. private mode / disabled storage).
  }
}
