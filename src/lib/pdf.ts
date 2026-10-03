import {jsPDF} from 'jspdf';
import type {FormDefinition,FieldValue} from '../types';
// Latin-only text: default jsPDF fonts cannot render Urdu script.
export function exportPdf(form:FormDefinition,vals:Record<string,FieldValue>){
 const d=new jsPDF({unit:'mm',format:'a4'});const W=210;let y=0;
 const footer=()=>{d.setFontSize(8).setTextColor(100).setFont('helvetica','normal').text('Prepared with Awaz Desk - please verify before submission',W/2,290,{align:'center'})};
 d.setFillColor(5,150,105).rect(0,0,W,22,'F');d.setTextColor(255).setFont('helvetica','bold').setFontSize(16).text(form.title,12,14);
 d.setTextColor(0).setFontSize(9).setFont('helvetica','normal').text('Application Summary - generated '+new Date().toLocaleDateString('en-GB'),12,30);y=36;
 for(const f of form.fields){
  const v=vals[f.id]?.value_en||'-';const lines=d.splitTextToSize(v,110) as string[];const h=Math.max(9,lines.length*5+4);
  if(y+h>260){footer();d.addPage();y=15}
  d.setDrawColor(150).rect(12,y,186,h);d.line(80,y,80,y+h);
  d.setFont('helvetica','bold').setFontSize(10).text(f.label_en,15,y+6);d.setFont('helvetica','normal').text(lines,83,y+6);y+=h;
 }
 y+=10;d.setFontSize(10).text('Declaration: I confirm the above information is correct.',12,y);d.text('Signature: ____________',12,y+14);footer();
 d.save(form.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-filled.pdf');
}
