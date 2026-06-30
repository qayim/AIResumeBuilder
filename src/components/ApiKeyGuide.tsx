import { ExternalIcon } from './icons'

const STEPS = [
  {
    title: 'Open Google AI Studio',
    body: (
      <>
        Go to{' '}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-brand-600 hover:underline"
        >
          aistudio.google.com/apikey
        </a>{' '}
        and sign in with your Google account.
      </>
    ),
  },
  {
    title: 'Create an API key',
    body: 'Click "Create API key". You can create it in a new project or pick an existing Google Cloud project.',
  },
  {
    title: 'Copy the key',
    body: 'Copy the generated key (it starts with "AIza..."). Treat it like a password — anyone with it can use your quota.',
  },
  {
    title: 'Paste it into Settings',
    body: 'Paste the key into the API key field here. It is stored only in your browser (localStorage) and sent directly to Google.',
  },
]

export default function ApiKeyGuide() {
  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-900">How to get a free Gemini API key</h3>
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
        >
          Open AI Studio <ExternalIcon width={13} height={13} />
        </a>
      </div>
      <ol className="space-y-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
              {i + 1}
            </span>
            <div className="text-sm">
              <p className="font-medium text-slate-800">{step.title}</p>
              <p className="text-slate-600">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 rounded-lg bg-white/70 p-2.5 text-xs text-slate-500">
        The free tier includes a generous daily quota — perfect for tailoring resumes. You only pay if
        you exceed free limits on a billed project.
      </p>
    </div>
  )
}
