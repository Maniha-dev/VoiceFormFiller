export interface Rec{stop:()=>void;result:Promise<Blob>}
export async function startRecording(onLevel:(l:number)=>void):Promise<Rec>{
 if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone needs HTTPS or localhost.');
 let stream:MediaStream;
 try{stream=await navigator.mediaDevices.getUserMedia({audio:true})}catch{throw new Error('Microphone blocked. Allow mic access in your browser address bar.')}
 const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(m=>MediaRecorder.isTypeSupported(m));
 const rec=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);const chunks:Blob[]=[];rec.ondataavailable=e=>chunks.push(e.data);
 const ctx=new AudioContext();const an=ctx.createAnalyser();an.fftSize=512;ctx.createMediaStreamSource(stream).connect(an);
 const buf=new Uint8Array(an.fftSize);let spoke=false,quiet=Date.now(),done=false;
 let resolve!:(b:Blob)=>void;const result=new Promise<Blob>(r=>{resolve=r});
 const stop=()=>{if(done)return;done=true;clearInterval(iv);clearTimeout(max);if(rec.state!=='inactive')rec.stop()};
 const iv=setInterval(()=>{an.getByteTimeDomainData(buf);let s=0;for(const v of buf){const d=(v-128)/128;s+=d*d}
  const l=Math.sqrt(s/buf.length);onLevel(l);if(l>0.04){spoke=true;quiet=Date.now()}else if(spoke&&Date.now()-quiet>2000)stop()},80);
 const max=setTimeout(stop,30000);
 rec.onstop=()=>{stream.getTracks().forEach(t=>t.stop());void ctx.close();onLevel(0);resolve(new Blob(chunks,{type:rec.mimeType||'audio/webm'}))};
 rec.start();return{stop,result};
}
export function speak(text:string,lang:string){try{const v=speechSynthesis.getVoices().find(x=>x.lang.toLowerCase().startsWith(lang));if(!v)return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.voice=v;speechSynthesis.speak(u)}catch{/* silent */}}
