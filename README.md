# Bol Kar Bharo
Speak (Urdu, Punjabi, Pashto, Sindhi, Roman Urdu, English) to fill a form; export a PDF.
## Setup
Use Node.js 20 or newer. Copy `.env.example` to `.env`, configure the server-only variables, then run `npm install && npm run dev`. The local Vite server mounts the same API handlers used by Vercel.
## Architecture
The React app calls `/api/gemini` for question generation, answer extraction, and guidance, and `/api/groq/transcriptions` for speech-to-text. Vercel runs these as serverless functions; local Vite development mounts the same handlers. API keys and model selection are server-side only.

Required server environment variables are `GEMINI_API_KEY`, `GROQ_API_KEY`, `GEMINI_MODEL`, and `GROQ_STT_MODEL`. The default models are `gemini-2.5-flash` and `whisper-large-v3-turbo`.

## Vercel
Deploy this repository as a Vite project. Add the four server variables above in the Vercel project settings for each environment. The `api/` directory is discovered as Vercel Node.js functions; no static-only deployment or separate server is needed.

For local use, `npm run dev` loads those variables from `.env` into the Vite server process. Never prefix provider secrets with `VITE_`.
## Not yet built
Upload flow (Reader Agent, pdfjs, image overlay), field-detection screen.
## Notes
API keys in a browser app are visible to the user; use a serverless proxy in production. Urdu STT is not 100% accurate; typed input is always available.
