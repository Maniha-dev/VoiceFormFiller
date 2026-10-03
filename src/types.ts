export type LangCode='ur'|'pa'|'ps'|'sd'|'roman-ur'|'en';
export type FieldType='text'|'cnic'|'phone'|'date'|'number'|'email'|'select'|'textarea';
export interface FormField{id:string;label_en:string;label_ur?:string;type:FieldType;required:boolean;options?:string[];box?:[number,number,number,number]}
export interface FieldValue{value_en:string;value_original?:string;valid:boolean;error?:string}
export interface FormDefinition{id:string;title:string;fields:FormField[];imageDataUrl?:string;documentsToBring?:string[]}
export interface AgentEvent{agent:'reader'|'interviewer'|'validator'|'guide';message:string;ts:number}
