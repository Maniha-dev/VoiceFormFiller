export const GEMINI_MODEL:string=import.meta.env.GEMINI_MODEL||'gemini-2.5-flash';
export const GROQ_MODEL:string=import.meta.env.GROQ_STT_MODEL||'whisper-large-v3-turbo';
export const getKey=(k:'gemini'|'groq'):string=>sessionStorage.getItem('key_'+k)||(k==='gemini'?import.meta.env.GEMINI_API_KEY:import.meta.env.GROQ_API_KEY)||'';
export const setKey=(k:'gemini'|'groq',v:string)=>sessionStorage.setItem('key_'+k,v.trim());
