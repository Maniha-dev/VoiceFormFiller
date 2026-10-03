export const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export async function fetchRetry(url:string,init:RequestInit):Promise<Response>{
 for(let i=0;i<2;i++){
  const c=new AbortController();const t=setTimeout(()=>c.abort(),25000);
  try{
     let r:Response;
     try{r=await fetch(url,{...init,signal:c.signal})}
     catch{if(i===1)throw new Error('Network error. Check your connection.');await sleep(1000);continue}
     if((r.status===429||r.status>=500)&&i===0){await sleep(1000);continue}
     if(!r.ok){
        let message='Request failed ('+r.status+')';
        try{const body=await r.json() as {error?:string};if(typeof body.error==='string')message=body.error}catch{}
        throw new Error(message);
     }
   return r;
    }catch(e){throw e}
  finally{clearTimeout(t)}
 }
 throw new Error('Network error. Check your connection.');
}
export type Part={text:string}|{inlineData:{mimeType:string;data:string}};
export async function callGeminiJSON<T>(parts:Part[],system:string):Promise<T>{
 for(let i=0;i<2;i++){
  try{
    const r=await fetchRetry('/api/gemini',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({parts,system})});
   const j=(await r.json()) as {candidates?:{content?:{parts?:{text?:string}[]}}[]};
   return JSON.parse((j.candidates?.[0]?.content?.parts?.[0]?.text??'').replace(/```json|```/g,'').trim()) as T;
  }catch(e){if(i===1||(e instanceof Error&&/key|wait|Network|failed \(/.test(e.message)))throw e}
 }
 throw new Error('Could not parse AI response.');
}
