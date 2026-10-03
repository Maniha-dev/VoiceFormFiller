import {GEMINI_MODEL,getKey} from '../config';
export const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export async function fetchRetry(url:string,init:RequestInit):Promise<Response>{
 for(let i=0;i<2;i++){
  const c=new AbortController();const t=setTimeout(()=>c.abort(),25000);
  try{
   const r=await fetch(url,{...init,signal:c.signal});
   if((r.status===429||r.status>=500)&&i===0){await sleep(1000);continue}
   if(r.status===401||r.status===403)throw new Error('Invalid API key. Check Settings.');
   if(r.status===429)throw new Error('Please wait a few seconds and try again.');
   if(!r.ok)throw new Error('Request failed ('+r.status+')');
   return r;
  }catch(e){const m=e instanceof Error?e.message:'';if(/key|wait|failed \(/.test(m))throw e;if(i===1)throw new Error('Network error. Check your connection.');await sleep(1000)}
  finally{clearTimeout(t)}
 }
 throw new Error('Network error. Check your connection.');
}
export type Part={text:string}|{inlineData:{mimeType:string;data:string}};
export async function callGeminiJSON<T>(parts:Part[],system:string):Promise<T>{
 const key=getKey('gemini');if(!key)throw new Error('Missing Gemini API key. Open Settings.');
 const url=`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
 for(let i=0;i<2;i++){
  try{
   const r=await fetchRetry(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts}],generationConfig:{responseMimeType:'application/json',temperature:0.2}})});
   const j=(await r.json()) as {candidates?:{content?:{parts?:{text?:string}[]}}[]};
   return JSON.parse((j.candidates?.[0]?.content?.parts?.[0]?.text??'').replace(/```json|```/g,'').trim()) as T;
  }catch(e){if(i===1||(e instanceof Error&&/key|wait|Network|failed \(/.test(e.message)))throw e}
 }
 throw new Error('Could not parse AI response.');
}
