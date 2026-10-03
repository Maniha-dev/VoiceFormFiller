import {callGeminiJSON} from '../lib/gemini';
import type {FormDefinition} from '../types';
export async function getGuide(form:FormDefinition):Promise<{documents:string[];tips:string[]}>{
 const demo=form.documentsToBring;
 try{const r=await callGeminiJSON<{documents?:string[];tips?:string[]}>([{text:JSON.stringify({title:form.title,fields:form.fields.map(f=>f.label_en),documentsToBring:demo})}],
  `Given this form title and fields, list the documents a Pakistani citizen should bring when submitting it (max 8) and 2-3 short practical tips. Simple English. Return ONLY JSON {"documents": string[], "tips": string[]}. For demo forms, use the provided documentsToBring and only generate tips.`);
  return{documents:demo??r.documents??[],tips:r.tips??[]}}
 catch{return{documents:demo??['Original CNIC (and a photocopy)','2 passport-size photographs'],tips:['Go early in the morning to avoid queues.','Keep photocopies of every document.']}}
}
