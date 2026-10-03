export const GEMINI_MODEL:string=import.meta.env.VITE_GEMINI_MODEL||'gemini-2.5-flash';
export const GROQ_MODEL:string=import.meta.env.VITE_GROQ_STT_MODEL||'whisper-large-v3-turbo';
export const getKey=(k:'gemini'|'groq'):string=>k==='gemini'?import.meta.env.VITE_GEMINI_API_KEY||'':import.meta.env.VITE_GROQ_API_KEY||'';
