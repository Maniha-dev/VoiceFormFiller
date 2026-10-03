import type {FormDefinition,FormField,FieldType} from '../types';
const f=(id:string,en:string,ur:string,type:FieldType,required:boolean,options?:string[]):FormField=>({id,label_en:en,label_ur:ur,type,required,options});
export const DEMOS:FormDefinition[]=[
{id:'bank',title:'Bank Account Opening (KYC)',documentsToBring:['Original CNIC (and a photocopy)','2 passport-size photographs','Recent utility bill as proof of address','Proof of income (salary slip or business proof)'],fields:[
f('full_name','Full Name','پورا نام','text',true),f('father_name',"Father's / Husband's Name",'والد / شوہر کا نام','text',true),f('cnic','CNIC Number','شناختی کارڈ نمبر','cnic',true),
f('dob','Date of Birth','تاریخ پیدائش','date',true),f('gender','Gender','جنس','select',true,['Male','Female','Other']),f('mobile','Mobile Number','موبائل نمبر','phone',true),
f('address','Current Address','موجودہ پتہ','textarea',true),f('city','City','شہر','text',true),f('occupation','Occupation','پیشہ','text',true),
f('monthly_income','Monthly Income (PKR)','ماہانہ آمدنی','number',false),f('nominee_name','Nominee Name','نامزد شخص کا نام','text',false),f('nominee_relation','Relation with Nominee','نامزد سے رشتہ','text',false)]},
{id:'support',title:'Social Support Application',documentsToBring:['Original CNIC of applicant','CNIC copies of all adult family members','B-Form of children','Recent utility bill or address proof'],fields:[
f('applicant_name','Applicant Name','درخواست دہندہ کا نام','text',true),f('cnic','CNIC Number','شناختی کارڈ نمبر','cnic',true),f('mobile','Mobile Number','موبائل نمبر','phone',true),
f('district','District','ضلع','text',true),f('address','Home Address','گھر کا پتہ','textarea',true),f('household_members','Number of Family Members','گھر کے افراد کی تعداد','number',true),
f('monthly_household_income','Monthly Household Income (PKR)','گھر کی ماہانہ آمدنی','number',true),f('has_disability','Any family member with disability?','کیا گھر میں کوئی معذور فرد ہے؟','select',true,['Yes','No'])]}];
