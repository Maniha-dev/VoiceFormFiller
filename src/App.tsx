import {useRef,useState} from 'react';
import {Mic,Square,Settings,Download,Loader2,Trash2,Contrast} from 'lucide-react';
import {DEMOS} from './data/demoForms';
import {validate,errorMessage} from './agents/validatorAgent';
import {askQuestion,extractAnswers} from './agents/interviewerAgent';
import {getGuide} from './agents/guideAgent';
import {startRecording,speak,type Rec} from './lib/audio';
import {transcribe} from './lib/groq';
import {exportPdf} from './lib/pdf';
import {getKey,setKey} from './config';
import type {AgentEvent,FieldValue,FormDefinition,LangCode} from './types';

const LANGS:[LangCode,string][]=[['ur','اردو Urdu'],['pa','پنجابی Punjabi'],['ps','پښتو Pashto'],['sd','سنڌي Sindhi'],['roman-ur','Roman Urdu'],['en','English']];
const RTL:LangCode[]=['ur','pa','ps','sd'];
type Vals=Record<string,FieldValue>;

export default function App(){
 const[screen,setScreen]=useState<'home'|'fill'|'review'>('home');
 const[form,setForm]=useState<FormDefinition|null>(null);
 const[vals,setVals]=useState<Vals>({});
 const[cur,setCur]=useState('');
 const[q,setQ]=useState('');
 const[lang,setLang]=useState<LangCode>('ur');
 const[busy,setBusy]=useState<''|'listening'|'working'>('');
 const[level,setLevel]=useState(0);
 const[text,setText]=useState('');
 const[said,setSaid]=useState('');
 const[log,setLog]=useState<AgentEvent[]>([]);
 const[toast,setToast]=useState('');
 const[live,setLive]=useState('');
 const[flash,setFlash]=useState('');
 const[showSet,setShowSet]=useState(false);
 const[hc,setHc]=useState(false);
 const[fs,setFs]=useState(16);
 const[guide,setGuide]=useState<{documents:string[];tips:string[]}|null>(null);
 const rec=useRef<Rec|null>(null);const fails=useRef(0);const skipped=useRef<Set<string>>(new Set());const textRef=useRef<HTMLInputElement>(null);

 const note=(agent:AgentEvent['agent'],message:string)=>setLog(l=>[...l,{agent,message,ts:Date.now()}]);
 const err=(e:unknown)=>setToast(e instanceof Error?e.message:'Something went wrong');
 const nextId=(f:FormDefinition,v:Vals)=>[...f.fields.filter(x=>x.required),...f.fields.filter(x=>!x.required)].find(x=>!v[x.id]&&!skipped.current.has(x.id))?.id;

 async function ask(f:FormDefinition,id:string,v:Vals){
  setCur(id);const field=f.fields.find(x=>x.id===id)!;
  const filled=Object.entries(v).map(([k,x])=>`${k}=${x.value_en}`).join('; ')||'nothing';
  const s=await askQuestion(field,lang,filled);setQ(s);note('interviewer','Asked: '+field.label_en);speak(s,lang==='roman-ur'?'ur':lang);
 }
 async function finish(f:FormDefinition){setScreen('review');setGuide(null);const g=await getGuide(f);note('guide',`Prepared ${g.documents.length} documents`);setGuide(g)}
 async function advance(f:FormDefinition,v:Vals){const n=nextId(f,v);if(!n)return finish(f);await ask(f,n,v)}
 async function start(d:FormDefinition){
  if(!getKey('gemini')){setToast('Missing Gemini API key. Open Settings (gear icon).');setShowSet(true);return}
  skipped.current=new Set();setForm(d);setVals({});setLog([]);setSaid('');setScreen('fill');setBusy('working');
  try{await advance(d,{})}catch(e){err(e)}finally{setBusy('')}
 }
 async function process(t:string){
  if(!form)return;setBusy('working');
  try{
   const field=form.fields.find(x=>x.id===cur)!;
   const r=await extractAnswers(t,form.fields.filter(x=>!vals[x.id]),field,lang);
   if(r.needs_clarification&&!Object.keys(r.updates).length){setQ(r.clarification||q);speak(r.clarification||q,lang);return}
   const nv={...vals};let e='';
   for(const[id,u]of Object.entries(r.updates)){
    const f=form.fields.find(x=>x.id===id);if(!f)continue;const c=validate(f,u.value_en);
    if(c.valid){nv[id]={value_en:c.value,value_original:u.value_original,valid:true};setFlash(id);setLive(`${f.label_en} filled`);note('validator',f.label_en+' OK')}
    else{note('validator',f.label_en+' invalid: '+c.error);if(id===cur)e=errorMessage(c.error!,lang)}
   }
   setVals(nv);
   if(e||!nv[cur]){const m=e||errorMessage('REQUIRED_EMPTY',lang);setQ(m);speak(m,lang==='roman-ur'?'ur':lang);return}
   await advance(form,nv);
  }catch(x){err(x);if(++fails.current>=2)textRef.current?.focus()}finally{setBusy('')}
 }
 async function toggleMic(){
  if(busy==='listening'){rec.current?.stop();return}
  if(busy)return;
  try{
   if(!getKey('groq')){setToast('Missing Groq API key. Open Settings.');setShowSet(true);return}
   rec.current=await startRecording(setLevel);setBusy('listening');
   const blob=await rec.current.result;setBusy('working');
   const t=await transcribe(blob,lang);
   if(!t){setToast("I couldn't hear you, please try again");setBusy('');return}
   setSaid(t);note('interviewer','Heard: '+t.slice(0,40));fails.current=0;await process(t);
  }catch(e){err(e);if(++fails.current>=2)textRef.current?.focus();setBusy('')}
 }
 function clearAll(){speechSynthesis?.cancel();rec.current?.stop();setForm(null);setVals({});setLog([]);setSaid('');setText('');setGuide(null);setScreen('home');sessionStorage.removeItem('form')}
 function edit(id:string,v:string){
  if(!form)return;const f=form.fields.find(x=>x.id===id)!;const c=validate(f,v);
  setVals(p=>({...p,[id]:{value_en:c.valid?c.value:v,valid:c.valid,error:c.valid?undefined:errorMessage(c.error!,'en')}}));
 }
 const filled=form?form.fields.filter(f=>vals[f.id]?.valid).length:0;
 const req=form?form.fields.filter(f=>f.required):[];const pct=req.length?Math.round(req.filter(f=>vals[f.id]?.valid).length/req.length*100):0;
 const cf=form?.fields.find(x=>x.id===cur);

 return(<div className={(hc?'hc bg-black text-yellow-300 ':'bg-slate-50 text-slate-800 ')+'min-h-screen'} style={{fontSize:fs}}>
  <header className="flex flex-wrap items-center gap-2 p-3 bg-white/90 shadow sticky top-0 z-10 text-slate-800">
   <b className="text-emerald-700 mr-auto">Bol Kar Bharo <span className="urdu">بول کر بھرو</span></b>
   <select aria-label="Language" className="border rounded-xl p-2 min-h-[48px]" value={lang} onChange={e=>setLang(e.target.value as LangCode)}>{LANGS.map(([c,n])=><option key={c} value={c}>{n}</option>)}</select>
   <button aria-label="High contrast" className="p-3 border rounded-xl min-h-[48px]" onClick={()=>setHc(!hc)}><Contrast size={18}/></button>
   <button aria-label="Font size" className="px-3 border rounded-xl min-h-[48px]" onClick={()=>setFs(fs===16?19:fs===19?22:16)}>{fs===16?'A':fs===19?'A+':'A++'}</button>
   <button aria-label="Settings" className="p-3 border rounded-xl min-h-[48px]" onClick={()=>setShowSet(true)}><Settings size={18}/></button>
  </header>
  <div aria-live="polite" className="sr-only">{live}</div>
  {toast&&<div role="alert" className="m-3 p-3 rounded-xl bg-red-600 text-white flex justify-between"><span>{toast}</span><button onClick={()=>setToast('')}>OK</button></div>}
  {(!getKey('gemini')||!getKey('groq'))&&<div className="m-3 p-3 rounded-xl bg-amber-100 text-amber-900">API keys missing. <button className="underline font-semibold" onClick={()=>setShowSet(true)}>Open Settings</button></div>}

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
    <button onClick={toggleMic} aria-label={busy==='listening'?'Stop recording':'Start recording'} className={'mx-auto grid place-items-center w-20 h-20 rounded-full text-white '+(busy==='listening'?'bg-red-600 animate-pulse':'bg-emerald-600')}>{busy==='working'?<Loader2 className="animate-spin"/>:busy==='listening'?<Square/>:<Mic size={32}/>}</button>
    <form className="flex gap-2" onSubmit={e=>{e.preventDefault();if(text.trim()&&!busy){const t=text;setText('');setSaid(t);void process(t)}}}>
     <input ref={textRef} value={text} onChange={e=>setText(e.target.value)} placeholder="Or type your answer" className="flex-1 border rounded-xl p-3 min-h-[48px]" dir="auto"/>
     <button className="px-4 bg-emerald-600 text-white rounded-xl min-h-[48px]" disabled={!!busy}>Send</button></form>
    <div className="flex gap-2"><button className="flex-1 border rounded-xl min-h-[48px]" onClick={()=>{speak(q,lang==='roman-ur'?'ur':lang)}}>Repeat question</button>
     {cf&&!cf.required&&<button className="flex-1 border rounded-xl min-h-[48px]" onClick={()=>{skipped.current.add(cur);void advance(form,vals)}}>Skip</button>}</div>
    <details className="text-sm"><summary>Agent activity</summary><ul className="max-h-40 overflow-auto">{log.slice(-12).map((l,i)=><li key={i}><b>{l.agent}:</b> {l.message}</li>)}</ul></details>
   </section>
   <section className="md:col-span-3 bg-white text-slate-800 rounded-2xl shadow p-4"><p className="text-xs text-slate-500 mb-2">Sample form — not an official document · {filled}/{form.fields.length} filled</p>
    {form.fields.map(f=><button key={f.id} onClick={()=>!busy&&void ask(form,f.id,vals)} className={'w-full text-left flex justify-between gap-2 border-b p-3 min-h-[48px] '+(cur===f.id?'ring-2 ring-emerald-500 rounded-xl animate-pulse ':'')+(flash===f.id?'flash':'')}>
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

  {showSet&&<div className="fixed inset-0 bg-black/50 grid place-items-center p-4 z-20"><div className="bg-white text-slate-800 rounded-2xl p-5 w-full max-w-md space-y-3">
   <b>Settings</b><p className="text-sm">Keys stay in this tab only (sessionStorage).</p>
   {(['gemini','groq'] as const).map(k=><label key={k} className="block text-sm">{k==='gemini'?'Google Gemini key':'Groq key'}<input type="password" defaultValue={getKey(k)} onChange={e=>setKey(k,e.target.value)} className="w-full border rounded-xl p-3 min-h-[48px]"/></label>)}
   <button className="w-full bg-emerald-600 text-white rounded-xl min-h-[48px]" onClick={()=>{setShowSet(false);setToast('')}}>Save</button></div></div>}
 </div>);
}
