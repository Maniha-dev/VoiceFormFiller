import {useEffect,useRef,useState} from 'react';
import {Mic,Square,Download,Loader2,Trash2,Contrast,Volume2} from 'lucide-react';
import {DEMOS} from './data/demoForms';
import {validate,errorMessage} from './agents/validatorAgent';
import {askQuestion,extractAnswers} from './agents/interviewerAgent';
import {getGuide} from './agents/guideAgent';
import {startRecording,type Rec} from './lib/audio';
import {transcribe} from './lib/groq';
import {exportPdf} from './lib/pdf';
import {speakAI,stopSpeaking} from './lib/tts';
import {GREET,DONE,NOHEAR} from './data/i18n';
import type {AgentEvent,FieldValue,FormDefinition,LangCode} from './types';

const LANGS:[LangCode,string][]=[['ur','اردو Urdu'],['pa','پنجابی Punjabi'],['ps','پښتو Pashto'],['sd','سنڌي Sindhi'],['roman-ur','Roman Urdu'],['en','English']];
const RTL:LangCode[]=['ur','pa','ps','sd'];
type Vals=Record<string,FieldValue>;

type Busy=''|'speaking'|'listening'|'working';
export default function App(){
 const[screen,setScreen]=useState<'home'|'fill'|'review'>('home');
 const[form,setForm]=useState<FormDefinition|null>(null);
 const[vals,setVals]=useState<Vals>({});
 const[cur,setCur]=useState('');
 const[q,setQ]=useState('');
 const[lang,setLang]=useState<LangCode>('ur');
 const[busy,setBusy]=useState<Busy>('');
 const[level,setLevel]=useState(0);
 const[text,setText]=useState('');
 const[said,setSaid]=useState('');
 const[log,setLog]=useState<AgentEvent[]>([]);
 const[toast,setToast]=useState('');
 const[live,setLive]=useState('');
 const[flash,setFlash]=useState('');
 const[hc,setHc]=useState(false);
 const[fs,setFs]=useState(16);
 const[hf,setHf]=useState(true);
 const[guide,setGuide]=useState<{documents:string[];tips:string[]}|null>(null);
 // Latest state for async voice loops (closures would otherwise go stale).
 const S=useRef({form:null as FormDefinition|null,vals:{} as Vals,cur:'',q:'',lang:'ur' as LangCode,hf:true,busy:'' as Busy,screen:'home',lock:false,cancel:false,manual:false,empties:0,fails:0});
 const rec=useRef<Rec|null>(null);const skipped=useRef<Set<string>>(new Set());const textRef=useRef<HTMLInputElement>(null);
 useEffect(()=>()=>{stopSpeaking();rec.current?.stop()},[]);

 const setB=(b:Busy)=>{S.current.busy=b;setBusy(b)};
 const note=(agent:AgentEvent['agent'],message:string)=>setLog(l=>[...l,{agent,message,ts:Date.now()}]);
 const err=(e:unknown)=>setToast(e instanceof Error?e.message:'Something went wrong');
 const nextId=(f:FormDefinition,v:Vals)=>[...f.fields.filter(x=>x.required),...f.fields.filter(x=>!x.required)].find(x=>!v[x.id]&&!skipped.current.has(x.id))?.id;
 const tl=(l:LangCode)=>l==='roman-ur'?'ur':l;

 async function say(t:string){setB('speaking');await speakAI(t,tl(S.current.lang));if(S.current.busy==='speaking')setB('')}
 // AI speaks, then (hands-free or mic tapped during speech) starts listening automatically.
 async function speakThen(t:string){
  const s=S.current;await say(t);const go=s.hf||s.manual;s.manual=false;
  if(go&&s.screen==='fill')setTimeout(()=>void listen(),200);
 }
 async function ask(f:FormDefinition,id:string,v:Vals,pre=''){
  const s=S.current;s.cur=id;setCur(id);const field=f.fields.find(x=>x.id===id)!;
  const filled=Object.entries(v).map(([k,x])=>`${k}=${x.value_en}`).join('; ')||'nothing';
  const qq=await askQuestion(field,s.lang,filled);s.q=qq;setQ(qq);note('interviewer','Asked: '+field.label_en);
  await speakThen(pre?pre+' '+qq:qq);
 }
 async function finish(f:FormDefinition){
  S.current.screen='review';setScreen('review');setGuide(null);void say(DONE[S.current.lang]);
  const g=await getGuide(f);note('guide',`Prepared ${g.documents.length} documents`);setGuide(g);
 }
 async function advance(f:FormDefinition,v:Vals,pre=''){const n=nextId(f,v);if(!n)return finish(f);await ask(f,n,v,pre)}
 async function start(d:FormDefinition){
  const s=S.current;skipped.current=new Set();s.form=d;s.vals={};s.screen='fill';s.empties=0;s.fails=0;
  setForm(d);setVals({});setLog([]);setSaid('');setScreen('fill');setB('working');
  try{await advance(d,{},GREET[s.lang])}catch(e){err(e);setB('')}
 }
 async function process(t:string){
  const s=S.current;const f=s.form;if(!f)return;setB('working');
  try{
   const field=f.fields.find(x=>x.id===s.cur)!;
   const r=await extractAnswers(t,f.fields.filter(x=>!s.vals[x.id]),field,s.lang);
   if(r.needs_clarification&&!Object.keys(r.updates).length){const m=r.clarification||s.q;setQ(m);await speakThen(m);return}
   const nv={...s.vals};let e='';
   for(const[id,u]of Object.entries(r.updates)){
    const ff=f.fields.find(x=>x.id===id);if(!ff)continue;const c=validate(ff,u.value_en);
    if(c.valid){nv[id]={value_en:c.value,value_original:u.value_original,valid:true};setFlash(id);setLive(`${ff.label_en} filled`);note('validator',ff.label_en+' OK')}
    else{note('validator',ff.label_en+' invalid: '+c.error);if(id===s.cur)e=errorMessage(c.error!,s.lang)}
   }
   s.vals=nv;setVals(nv);
   if(e||!nv[s.cur]){const m=e||errorMessage('REQUIRED_EMPTY',s.lang);setQ(m);await speakThen(m);return}
   await advance(f,nv);
  }catch(x){err(x);if(++s.fails>=2)textRef.current?.focus()}finally{if(S.current.busy==='working')setB('')}
 }
 async function listen(){
  const s=S.current;if(s.lock||s.screen!=='fill'||s.busy==='listening')return;s.lock=true;s.cancel=false;
  let retry=false;
  try{
   rec.current=await startRecording(setLevel);setB('listening');
   const blob=await rec.current.result;
   let t='';if(blob){setB('working');t=await transcribe(blob,s.lang)}
   if(!t){
    setB('');if(s.cancel)return;
    if(++s.empties<=2&&s.hf){retry=true;await say(NOHEAR[s.lang])}
    else{setToast(NOHEAR.en);textRef.current?.focus()}
    return;
   }
   s.empties=0;s.fails=0;setSaid(t);note('interviewer','Heard: '+t.slice(0,40));await process(t);
  }catch(e){err(e);setB('');if(++s.fails>=2)textRef.current?.focus()}
  finally{s.lock=false;if(retry&&s.screen==='fill')setTimeout(()=>void listen(),200)}
 }
 function onMic(){
  const s=S.current;
  if(s.busy==='listening'){rec.current?.stop();return}
  if(s.busy==='speaking'){s.manual=true;stopSpeaking();return}
  if(!s.busy)void listen();
 }
 function clearAll(){
  const s=S.current;s.screen='home';s.cancel=true;s.form=null;s.vals={};stopSpeaking();rec.current?.stop();setB('');
  setForm(null);setVals({});setLog([]);setSaid('');setText('');setGuide(null);setQ('');setScreen('home');
 }
 function edit(id:string,v:string){
  if(!form)return;const f=form.fields.find(x=>x.id===id)!;const c=validate(f,v);
  setVals(p=>({...p,[id]:{value_en:c.valid?c.value:v,valid:c.valid,error:c.valid?undefined:errorMessage(c.error!,'en')}}));
 }
 const filled=form?form.fields.filter(f=>vals[f.id]?.valid).length:0;
 const req=form?form.fields.filter(f=>f.required):[];const pct=req.length?Math.round(req.filter(f=>vals[f.id]?.valid).length/req.length*100):0;
 const cf=form?.fields.find(x=>x.id===cur);

 return(<div className={(hc?'hc bg-black text-yellow-300 ':'bg-slate-50 text-slate-800 ')+'min-h-screen'} style={{fontSize:fs}}>
  <header className="flex flex-wrap items-center gap-2 p-3 bg-white/90 shadow sticky top-0 z-10 text-slate-800">
   <b className="text-emerald-700 mr-auto">Awaz Desk <span className="urdu">آواز ڈیسک</span></b>
   <select aria-label="Language" className="border rounded-xl p-2 min-h-[48px]" value={lang} onChange={e=>{S.current.lang=e.target.value as LangCode;setLang(e.target.value as LangCode)}}>{LANGS.map(([c,n])=><option key={c} value={c}>{n}</option>)}</select>
   <button aria-pressed={hf} className={'px-3 border rounded-xl min-h-[48px] '+(hf?'bg-emerald-600 text-white':'')} onClick={()=>{S.current.hf=!hf;setHf(!hf)}}>Hands-free {hf?'ON':'OFF'}</button>
   <button aria-label="High contrast" className="p-3 border rounded-xl min-h-[48px]" onClick={()=>setHc(!hc)}><Contrast size={18}/></button>
   <button aria-label="Font size" className="px-3 border rounded-xl min-h-[48px]" onClick={()=>setFs(fs===16?19:fs===19?22:16)}>{fs===16?'A':fs===19?'A+':'A++'}</button>
  </header>
  <div aria-live="polite" className="sr-only">{live}</div>
  {toast&&<div role="alert" className="m-3 p-3 rounded-xl bg-red-600 text-white flex justify-between"><span>{toast}</span><button onClick={()=>setToast('')}>OK</button></div>}
  {screen==='home'&&<main className="max-w-3xl mx-auto p-6 text-center">
   <Mic className="mx-auto text-emerald-600" size={56}/><h1 className="text-3xl font-bold mt-3">Speak to Fill Any Form</h1>
   <p className="urdu text-xl mt-2" dir="rtl">جو پڑھ لکھ نہیں سکتا، وہ بول کر بھرے</p><p className="mt-1">Digital access for everyone who can speak.</p>
   <div className="grid sm:grid-cols-2 gap-4 mt-8">{DEMOS.map(d=><button key={d.id} onClick={()=>start(d)} className="bg-white text-slate-800 rounded-2xl shadow p-6 min-h-[48px] hover:ring-2 ring-emerald-500 text-left"><b>Demo: {d.title}</b><p className="text-sm text-slate-500 mt-1">Sample form — not an official document</p></button>)}</div>
   <p className="mt-8 text-sm bg-emerald-50 text-emerald-900 rounded-xl p-3">Nothing is stored. Data lives only in this tab. Audio is sent to Groq and text to Google Gemini for processing only.</p>
  </main>}

  {screen==='fill'&&form&&<main className="grid md:grid-cols-5 gap-4 p-4 max-w-6xl mx-auto">
   <section className="md:col-span-2 bg-white text-slate-800 rounded-2xl shadow p-4 space-y-3">
    <div className="flex items-center justify-between"><b>{form.title}</b><span className="rounded-full border-4 border-emerald-500 w-14 h-14 grid place-items-center font-bold" role="progressbar" aria-valuenow={pct}>{pct}%</span></div>
    <div className={'p-4 rounded-xl bg-emerald-50 text-xl '+(RTL.includes(lang)?'urdu':'')} dir={RTL.includes(lang)?'rtl':'ltr'}>{busy==='working'&&!q?<Loader2 className="animate-spin"/>:q}</div>
    {said&&<p className="text-sm bg-slate-100 rounded-xl p-2" dir="auto">“{said}”</p>}
    <div className="flex items-center justify-center gap-1 h-10">{Array.from({length:16},(_,i)=><i key={i} className="w-1.5 bg-emerald-500 rounded" style={{height:4+Math.min(36,level*400*(1+Math.sin(i+Date.now()/200)/2))}}/>)}</div>
   <button onClick={onMic} aria-label="Microphone" className={'mx-auto grid place-items-center w-20 h-20 rounded-full text-white '+(busy==='listening'?'bg-red-600 animate-pulse':busy==='speaking'?'bg-blue-600':'bg-emerald-600')}>{busy==='working'?<Loader2 className="animate-spin"/>:busy==='listening'?<Square/>:busy==='speaking'?<Volume2 size={32}/>:<Mic size={32}/>}</button>
   <p className="text-center text-sm" aria-live="polite">{busy==='speaking'?'AI is speaking… tap to answer now':busy==='listening'?'Listening… speak now':busy==='working'?'Understanding…':'Tap the mic to answer'}</p>
   <form className="flex gap-2" onSubmit={e=>{e.preventDefault();if(text.trim()&&(busy===''||busy==='speaking')){stopSpeaking();const t=text;setText('');setSaid(t);void process(t)}}}>
    <input ref={textRef} value={text} onChange={e=>setText(e.target.value)} onFocus={()=>{if(S.current.busy==='listening'){S.current.cancel=true;rec.current?.stop()}}} placeholder="Or type your answer" className="flex-1 border rounded-xl p-3 min-h-[48px]" dir="auto"/>
    <button className="px-4 bg-emerald-600 text-white rounded-xl min-h-[48px]" disabled={busy==='working'||busy==='listening'}>Send</button></form>
   <div className="flex gap-2"><button className="flex-1 border rounded-xl min-h-[48px]" onClick={()=>{if(!busy)void speakThen(S.current.q||q)}}>Repeat question</button>
    {cf&&!cf.required&&<button className="flex-1 border rounded-xl min-h-[48px]" onClick={()=>{skipped.current.add(S.current.cur);stopSpeaking();void advance(form,S.current.vals)}}>Skip</button>}</div>
    <details className="text-sm"><summary>Agent activity</summary><ul className="max-h-40 overflow-auto">{log.slice(-12).map((l,i)=><li key={i}><b>{l.agent}:</b> {l.message}</li>)}</ul></details>
   </section>
   <section className="md:col-span-3 bg-white text-slate-800 rounded-2xl shadow p-4"><p className="text-xs text-slate-500 mb-2">Sample form — not an official document · {filled}/{form.fields.length} filled</p>
   {form.fields.map(f=><button key={f.id} onClick={()=>{if(busy==='listening'||busy==='working')return;stopSpeaking();void ask(form,f.id,S.current.vals)}} className={'w-full text-left flex justify-between gap-2 border-b p-3 min-h-[48px] '+(cur===f.id?'ring-2 ring-emerald-500 rounded-xl animate-pulse ':'')+(flash===f.id?'flash':'')}>
     <span>{f.label_en}{f.required&&' *'}</span><b>{vals[f.id]?.value_en??''}</b></button>)}
    {pct===100&&<button className="mt-3 w-full bg-emerald-600 text-white rounded-xl p-3" onClick={()=>void finish(form)}>Go to review</button>}
   </section></main>}

  {screen==='review'&&form&&<main className="max-w-3xl mx-auto p-4 space-y-4">
   <h2 className="text-2xl font-bold">Review: {form.title}</h2>
   <div className="bg-white text-slate-800 rounded-2xl shadow p-4 space-y-3">{form.fields.map(f=><label key={f.id} className="block"><span className="text-sm">{f.label_en}{f.required&&' *'} {vals[f.id]&&(vals[f.id].valid?'✓':'✗ '+vals[f.id].error)}</span>
    <input className="w-full border rounded-xl p-3 min-h-[48px]" value={vals[f.id]?.value_en??''} onChange={e=>edit(f.id,e.target.value)}/></label>)}</div>
   <div className="bg-white text-slate-800 rounded-2xl shadow p-4"><b>Documents to bring</b>{guide?<><ul className="list-disc ml-6">{guide.documents.map(d=><li key={d}>{d}</li>)}</ul><b>Tips</b><ul className="list-disc ml-6">{guide.tips.map(d=><li key={d}>{d}</li>)}</ul></>:<Loader2 className="animate-spin"/>}</div>
   <div className="flex flex-wrap gap-2">
    <button className="flex items-center gap-2 px-6 bg-emerald-600 text-white rounded-xl min-h-[48px]" onClick={()=>{try{exportPdf(form,vals)}catch{setToast('Could not create the PDF.')}}}><Download size={18}/>Download PDF</button>
    <button className="px-6 border rounded-xl min-h-[48px]" onClick={()=>setScreen('fill')}>Back to session</button>
    <button className="px-6 border rounded-xl min-h-[48px]" onClick={clearAll}>Start new form</button>
    <button className="flex items-center gap-2 px-6 border rounded-xl min-h-[48px]" onClick={clearAll}><Trash2 size={18}/>Clear all data</button></div></main>}

 </div>);
}
