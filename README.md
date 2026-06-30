# ResumeTailor — AI Resume Builder (Gemini)

Paste a **job description** and your **current resume**, and ResumeTailor uses Google's **Gemini** model to:

- Rewrite & tailor your resume to the specific role (without inventing anything).
- Estimate your **chance of landing an interview** as a percentage, with reasoning.
- Show **matched** vs **missing** keywords and concrete improvement suggestions.
- Export the tailored resume as a polished **`.docx`** file.

Everything runs **100% in your browser**. Your Gemini API key and your inputs never touch any server except Google's official API.

## Features

- **Bring your own Gemini API key** — configure it in the in-app Settings panel, with a built-in step-by-step guide on how to retrieve one.
- **Token controls** — pick the model, cap max output tokens, and tune creativity (temperature). Per-request token usage (input / output / total) is displayed after each run.
- **Structured output** — Gemini returns a strict JSON schema, so the resume is rendered cleanly and exported faithfully to `.docx`.
- **Modern UI** — responsive, accessible, built with React + Tailwind.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Run the dev server

```bash
npm run dev
```

Open the URL it prints (default `http://localhost:5173`).

### 3. Add your Gemini API key

On first load the Settings panel opens automatically. Follow the in-app guide, or:

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and sign in.
2. Click **Create API key**.
3. Copy the key (starts with `AIza...`).
4. Paste it into the **Gemini API key** field and click **Save settings**.

The free tier has a generous daily quota that is plenty for tailoring resumes.

### 4. Tailor a resume

1. Paste the full **job description**.
2. Paste your **current resume** as plain text.
3. Click **Tailor my resume**.
4. Review the interview-chance score, keywords, and suggestions, then **Download .docx**.

## Configuration reference (Settings panel)

| Setting              | What it does                                                                 |
| -------------------- | ---------------------------------------------------------------------------- |
| **Gemini API key**   | Your key. Stored in browser `localStorage` only.                             |
| **Model**            | Which Gemini model to call (Flash for speed/cost, Pro for quality).          |
| **Max output tokens**| Upper limit on how much the model can generate per request.                  |
| **Temperature**      | Lower = more factual/consistent (recommended). Higher = more varied wording. |

## Build for production

```bash
npm run build      # outputs static files to dist/
npm run preview    # preview the production build locally
```

The `dist/` folder is fully static and can be hosted on any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages, etc.).

## Deploy to GitHub Pages

This repo includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds and publishes the site automatically.

1. Push the project to a GitHub repository (default branch `main`).
2. In the repo, go to **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
3. Every push to `main` builds the app and deploys it. Your site will be live at:

   ```
   https://<your-username>.github.io/<your-repo>/
   ```

`vite.config.ts` uses `base: './'` (relative asset paths), so it works correctly under the GitHub Pages project subpath without extra configuration. To deploy manually instead, run `npm run build` and serve the `dist/` folder anywhere.

> Note: the app is static, so each visitor enters **their own** Gemini key in Settings (stored in their own browser). No key is ever bundled into the deployed site.

## Tech stack

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) build tooling
- [Tailwind CSS](https://tailwindcss.com/) styling
- [docx](https://docx.js.org/) for `.docx` generation
- [file-saver](https://github.com/eligrey/FileSaver.js) for downloads
- Google [Gemini API](https://ai.google.dev/) (`generativelanguage.googleapis.com`)

## Privacy & security notes

- Your API key is stored only in your browser's `localStorage`.
- API requests are sent **directly** from your browser to Google's Gemini endpoint.
- Because the key lives in the browser, this is intended for **personal / local use**. If you deploy it publicly for others, route requests through a backend proxy so users supply their own keys (the app already supports per-user keys via Settings) — never hardcode a shared key.

## Honesty disclaimer

The interview-chance percentage is an AI estimate based on the overlap between your real qualifications and the job's requirements. It is a guide, not a guarantee. The tailoring prompt explicitly instructs the model **not** to fabricate experience — keep your inputs truthful.
