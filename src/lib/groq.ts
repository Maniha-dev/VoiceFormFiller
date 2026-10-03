import {fetchRetry} from './gemini';
import type {LangCode} from '../types';
export async function transcribe(blob:Blob,lang:LangCode):Promise<string>{
 const fd=new FormData();fd.append('file',blob,blob.type.includes('mp4')?'a.mp4':'a.webm');
 const iso=lang==='roman-ur'?'ur':lang;if(iso!=='sd')fd.append('language',iso);
 const r=await fetchRetry('/api/groq/transcriptions',{method:'POST',body:fd});
 return(((await r.json()) as {text?:string}).text??'').trim();
}
