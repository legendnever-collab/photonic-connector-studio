import type { Prescription, Surface } from './model';
export type MaterialName='air'|'N-BK7';
/** SCHOTT N-BK7 Sellmeier, lambda in micrometres; nominal room-temperature glass. */
export function materialIndex(name:MaterialName,wavelength:number):number {
 if(name==='air')return 1;
 if(wavelength<.3e-6||wavelength>2.5e-6)throw Error('N-BK7: supported wavelength 300–2500 nm');
 const l2=(wavelength*1e6)**2,B=[1.03961212,.231792344,1.01046945],C=[.00600069867,.0200179144,103.560653];
 return Math.sqrt(1+B.reduce((v,b,i)=>v+b*l2/(l2-C[i]),0));
}
/** Named material owns n. Explicit numeric edits select Custom n, without a stale label. */
export function resolveMaterials(previous:Prescription,next:Prescription):Prescription {
 let surfaces=next.surfaces.map(s=>{
  const old=previous.surfaces.find(x=>x.id===s.id),value={...s};
  for(const [tag,key] of [['materialBefore','nBefore'],['materialAfter','nAfter']] as const){
   if(old&&value[tag]===old[tag]&&value[key]!==old[key])delete value[tag];
   if(value[tag])value[key]=materialIndex(value[tag],next.wavelength);
  }
  return value;
 });
 for(const a of next.assemblies.filter(a=>a.kind==='lens')){
  const pair=surfaces.filter(s=>s.assemblyId===a.id);if(pair.length!==2)continue;
  const [front,rear]=pair,oldF=previous.surfaces.find(s=>s.id===front.id),oldR=previous.surfaces.find(s=>s.id===rear.id);
  if(!oldF||!oldR)continue;
  const changed=(s:Surface,o:Surface,tag:'materialAfter'|'materialBefore',key:'nAfter'|'nBefore')=>s[tag]!==o[tag]||s[key]!==o[key];
  const f=changed(front,oldF,'materialAfter','nAfter'),r=changed(rear,oldR,'materialBefore','nBefore');
  if(f&&!r)surfaces=surfaces.map(s=>s.id===rear.id?{...s,materialBefore:front.materialAfter,nBefore:front.nAfter}:s);
  if(r&&!f)surfaces=surfaces.map(s=>s.id===front.id?{...s,materialAfter:rear.materialBefore,nAfter:rear.nBefore}:s);
  if(f&&r&&front.nAfter!==rear.nBefore)throw Error('Paired Lens internal medium must agree at S1 and S2');
 }
 return {...next,surfaces};
}
