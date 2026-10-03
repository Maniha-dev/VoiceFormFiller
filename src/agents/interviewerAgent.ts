import {callGeminiJSON} from '../lib/gemini';
import type {FormField,LangCode} from '../types';
const NAMES:Record<LangCode,string>={ur:'Urdu (Urdu script)',pa:'Punjabi (Shahmukhi script)',ps:'Pashto (Pashto script)',sd:'Sindhi (Sindhi script)','roman-ur':'Roman Urdu (Latin letters)',en:'English'};
const cache=new Map<string,string>();
export async function askQuestion(f:FormField,lang:LangCode,filled:string):Promise<string>{
 const k=f.id+lang;const c=cache.get(k);if(c)return c;
 try{const r=await callGeminiJSON<{question:string}>([{text:`Field: ${f.label_en} (${f.type}). Options: ${f.options?.join(', ')??'none'}. Already filled: ${filled}. Language: ${NAMES[lang]}.`}],
  `Ask the user ONE short, polite, simple question (max 15 words) in the given language to fill this form field. Use respectful "aap". For select fields include the options. Return ONLY JSON {"question": string}.`);
  if(!r.question)throw new Error('empty');cache.set(k,r.question);return r.question}
 catch{return `${lang==='en'?f.label_en:f.label_ur??f.label_en} ${lang==='en'?'please':'bataiye'}`}
}
export interface Extract{updates:Record<string,{value_en:string;value_original:string}>;needs_clarification:boolean;clarification?:string}
export async function extractAnswers(t:string,remaining:FormField[],cur:FormField,lang:LangCode):Promise<Extract>{
 const r=await callGeminiJSON<Partial<Extract>>([{text:JSON.stringify({transcript:t,language:NAMES[lang],currentField:cur,remainingFields:remaining.map(x=>({id:x.id,label:x.label_en,type:x.type,options:x.options}))})}],
 `The user is filling a form by voice. The transcript may be Urdu, Punjabi, Pashto, Sindhi, Roman Urdu, English, or mixed, and may contain speech-recognition mistakes. Convert spoken numbers and Urdu/Arabic-Indic digits (۰۱۲۳۴۵۶۷۸۹ / ٠١٢٣٤٥٦٧٨٩) into ASCII digits. Fill the CURRENT field first; also fill any other REMAINING fields the user clearly answered. value_en must be in English / Latin script (transliterate names, e.g. "مانیہ" -> "Maneeha"; translate occupations and cities to English; dates as DD/MM/YYYY; phone as 03XXXXXXXXX; CNIC as 13 digits without dashes). value_original is the user's wording. Never invent values. If the answer is unclear or empty, set needs_clarification true and write a short clarification question in the user's language. Return ONLY JSON: {"updates": {"<fieldId>": {"value_en": string, "value_original": string}}, "needs_clarification": boolean, "clarification": string}.`);
 return{updates:r.updates??{},needs_clarification:!!r.needs_clarification,clarification:r.clarification};
}
