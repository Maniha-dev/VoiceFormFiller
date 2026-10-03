import {fetchRetry} from './gemini';
// AI voice: Gemini TTS via /api/tts, with browser speechSynthesis as fallback.
let audio:HTMLAudioElement|null=null,url='',finish:(()=>void)|null=null;
const cache=new Map<string,Blob>();
export function stopSpeaking(){
 if(audio){audio.pause();audio=null}
 if(url){URL.revokeObjectURL(url);url=''}
 try{speechSynthesis.cancel()}catch{/* no tts */}
 finish?.();finish=null;
}
function browserSpeak(text:string,lang:string):Promise<void>{
 return new Promise(res=>{
  try{const v=speechSynthesis.getVoices().find(x=>x.lang.toLowerCase().startsWith(lang));if(!v){res();return}
   const u=new SpeechSynthesisUtterance(text);u.voice=v;u.onend=()=>res();u.onerror=()=>res();finish=res;speechSynthesis.speak(u)}catch{res()}
 });
}
/** Resolves when the speech has finished (or was stopped / failed). */
export async function speakAI(text:string,lang:string):Promise<void>{
 stopSpeaking();
 try{
  let blob=cache.get(text);
  if(!blob){const r=await fetchRetry('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,lang})});blob=await r.blob();cache.set(text,blob)}
  const b=blob;
  await new Promise<void>(res=>{url=URL.createObjectURL(b);const a=new Audio(url);audio=a;finish=res;a.onended=()=>res();a.onerror=()=>res();a.play().catch(()=>res())});
 }catch{await browserSpeak(text,lang)}
}
