import {GROQ_MODEL,getKey} from '../config';
import {fetchRetry} from './gemini';
import type {LangCode} from '../types';
export async function transcribe(blob:Blob,lang:LangCode):Promise<string>{
 const key=getKey('groq');if(!key)throw new Error('Missing Groq API key. Open Settings.');
 const fd=new FormData();fd.append('file',blob,blob.type.includes('mp4')?'a.mp4':'a.webm');fd.append('model',GROQ_MODEL);fd.append('response_format','json');
 const iso=lang==='roman-ur'?'ur':lang;if(iso!=='sd')fd.append('language',iso);
 const r=await fetchRetry('https://api.groq.com/openai/v1/audio/transcriptions',{method:'POST',headers:{Authorization:'Bearer '+key},body:fd});
 return(((await r.json()) as {text?:string}).text??'').trim();
}
