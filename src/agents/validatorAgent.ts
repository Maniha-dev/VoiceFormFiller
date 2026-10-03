import type {FormField,LangCode} from '../types';
export interface VResult{valid:boolean;error?:string;value:string}
export function validate(f:FormField,raw:string):VResult{
 const v=raw.trim();const bad=(error:string):VResult=>({valid:false,error,value:v});const ok=(value:string):VResult=>({valid:true,value});
 switch(f.type){
  case'cnic':{const d=v.replace(/[\s-]/g,'');return/^\d{13}$/.test(d)?ok(`${d.slice(0,5)}-${d.slice(5,12)}-${d[12]}`):bad('CNIC_LENGTH')}
  case'phone':{let d=v.replace(/[\s-]/g,'');if(d.startsWith('+92'))d='0'+d.slice(3);else if(d.startsWith('92')&&d.length===12)d='0'+d.slice(2);return/^03\d{9}$/.test(d)?ok(d):bad('PHONE_FORMAT')}
  case'date':{const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);if(!m)return bad('DATE_INVALID');const[d,mo,y]=[+m[1],+m[2],+m[3]];const dt=new Date(y,mo-1,d);
   if(dt.getFullYear()!==y||dt.getMonth()!==mo-1||dt.getDate()!==d||y<1900||dt>new Date())return bad('DATE_INVALID');return ok(`${String(d).padStart(2,'0')}/${String(mo).padStart(2,'0')}/${y}`)}
  case'number':return v!==''&&!isNaN(+v)&&+v>=0?ok(String(+v)):bad('NUMBER_INVALID');
  case'email':return/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)?ok(v):bad('EMAIL_INVALID');
  case'select':{const o=f.options?.find(x=>x.toLowerCase()===v.toLowerCase());return o?ok(o):bad('OPTION_INVALID')}
  default:return v.length>=2||!f.required?ok(v):bad('REQUIRED_EMPTY');
 }}
const M:Record<string,Record<LangCode,string>>={
CNIC_LENGTH:{ur:'شناختی کارڈ نمبر 13 ہندسوں کا ہونا چاہیے۔ دوبارہ بتائیے۔',pa:'شناختی کارڈ نمبر 13 ہندسیاں دا ہونا چاہیدا اے۔ دوبارہ دسو۔',ps:'د پیژندپاڼې شمېره باید ۱۳ عدده وي. بیا ووایاست.',sd:'شناختي ڪارڊ نمبر 13 انگن جو هجڻ گهرجي. ورائي ٻڌايو.','roman-ur':'CNIC 13 hindson ka hona chahiye. Dobara bataiye.',en:'CNIC must be 13 digits. Please say it again.'},
PHONE_FORMAT:{ur:'موبائل نمبر 03 سے شروع ہو کر 11 ہندسوں کا ہو۔ دوبارہ بتائیے۔',pa:'موبائل نمبر 03 توں شروع ہو کے 11 ہندسیاں دا ہووے۔ دوبارہ دسو۔',ps:'موبایل شمېره باید په 03 پیل او ۱۱ عدده وي. بیا ووایاست.',sd:'موبائل نمبر 03 کان شروع ٿي 11 انگن جو هجي. ورائي ٻڌايو.','roman-ur':'Mobile number 03 se shuru ho aur 11 hindson ka ho. Dobara bataiye.',en:'Mobile number must start with 03 and have 11 digits.'},
DATE_INVALID:{ur:'تاریخ درست نہیں۔ دن، مہینہ اور سال بتائیے۔',pa:'تاریخ ٹھیک نہیں۔ دن، مہینہ تے سال دسو۔',ps:'نېټه سمه نه ده. ورځ، میاشت او کال ووایاست.',sd:'تاريخ صحيح ناهي. ڏينهن، مهينو ۽ سال ٻڌايو.','roman-ur':'Tareekh durust nahi. Din, mahina aur saal bataiye.',en:'Invalid date. Please give day, month and year.'},
NUMBER_INVALID:{ur:'براہ کرم صرف عدد بتائیے۔',pa:'مہربانی کر کے صرف عدد دسو۔',ps:'مهرباني وکړئ یوازې شمېره ووایاست.',sd:'مهرباني ڪري رڳو انگ ٻڌايو.','roman-ur':'Sirf adad bataiye.',en:'Please give a number only.'},
EMAIL_INVALID:{ur:'ای میل درست نہیں۔',pa:'ای میل ٹھیک نہیں۔',ps:'بریښنالیک سم نه دی.',sd:'اي ميل صحيح ناهي.','roman-ur':'Email durust nahi.',en:'Invalid email address.'},
OPTION_INVALID:{ur:'دی گئی آپشنز میں سے ایک چنیں۔',pa:'دتیاں آپشناں چوں اک چنو۔',ps:'له ورکړل شویو اختیارونو یو غوره کړئ.',sd:'ڏنل چونڊن مان هڪ چونڊيو.','roman-ur':'Di gayi options mein se ek chuniye.',en:'Please choose one of the options.'},
REQUIRED_EMPTY:{ur:'یہ معلومات ضروری ہے۔ دوبارہ بتائیے۔',pa:'ایہ معلومات ضروری اے۔ دوبارہ دسو۔',ps:'دا معلومات اړین دي. بیا ووایاست.',sd:'هيءَ معلومات ضروري آهي. ورائي ٻڌايو.','roman-ur':'Ye maloomat zaroori hai. Dobara bataiye.',en:'This is required. Please try again.'}};
export const errorMessage=(code:string,lang:LangCode)=>M[code]?.[lang]??M.REQUIRED_EMPTY[lang];
