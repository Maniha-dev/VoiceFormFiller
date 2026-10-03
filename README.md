# Bol Kar Bharo
Speak (Urdu, Punjabi, Pashto, Sindhi, Roman Urdu, English) to fill a form; export a PDF.
## Setup
`npm install && npm run dev`. Copy `.env.example` to `.env` or paste keys in Settings (gear). Free keys: console.groq.com, aistudio.google.com.
## Architecture
Interviewer (Gemini question + extraction) -> Groq Whisper STT -> Validator (pure TS) -> Guide (documents/tips). Reader agent is not built yet.
## Not yet built
Upload flow (Reader Agent, pdfjs, image overlay), field-detection screen.
## Notes
API keys in a browser app are visible to the user; use a serverless proxy in production. Urdu STT is not 100% accurate; typed input is always available.
