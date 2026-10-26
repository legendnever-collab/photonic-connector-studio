import {newPhysicalProject,framePose} from '../src/authoring/commands';
import {applySmfReference} from '../src/authoring/smf';
import {pose,V} from '../src/surface/model';
import type {Surface,Frame} from '../src/surface/model';
import {materialIndex} from '../src/surface/materials';
import {ProjectSchema} from '../src/project/model';

/** Independent, millimetre-scale collimated fixtures. No routing/synthesis constructor. */
export function prismFixture(kind:'one'|'two'|'mixed'|'mirrors'='one',polarization:'TE'|'TM'='TE'){
 let p=applySmfReference(newPhysicalProject(),'target');
 if(p.model.kind!=='surface')throw Error('physical');
 const d=p.model.prescription,n=materialIndex('N-BK7',d.wavelength),base=d.surfaces[0];
 d.name=`D2.2.1 collimated ${kind} · ${polarization}`;d.assemblies=[];d.surfaces=[];p.bodies=[];
 p.model.sourceMode={representation:'gaussian',mfdX:.0004,mfdY:.0005,polarization};
 p.model.targetMode={...p.model.sourceMode};
 const surface=(id:string,assemblyId:string,frame:Surface['frame'],interaction:Surface['interaction'],n1=1,n2=1):Surface=>({...base,id,name:id,assemblyId,frame,interaction,nBefore:n1,nAfter:n2,materialBefore:n1===1?'air':'N-BK7',materialAfter:n2===1?'air':'N-BK7',outsideIndex:1,aperture:.003});
 const insert=(id:string,origin:Frame['origin'],axes:Frame['axes'],mirror=false)=>{
  d.assemblies.push({id,name:id,kind:mirror?'mirror':'prism',parentId:null,frame:framePose({origin,axes})});
  if(mirror){d.surfaces.push(surface(id+'-M',id,pose(.001,0,0,-Math.PI/4),'reflect'));p.bodies.push({assemblyId:id,kind:'mirror',outline:'disc',width:.006,height:.006,thickness:20e-6});}
  else {d.surfaces.push(surface(id+'-E',id,pose(),'refract',1,n),surface(id+'-T',id,pose(.001,0,0,-Math.PI/4),'tir',n,n),surface(id+'-X',id,pose(.001,.001,0,Math.PI/2),'refract',n,1));p.bodies.push({assemblyId:id,kind:'prism',depth:.006});}
 };
 const xz:Frame['axes']=[V(1),V(0,0,1),V(0,-1,0)],zx:Frame['axes']=[V(0,0,1),V(1),V(0,1,0)];
 insert('A',V(.003),xz,kind==='mixed'||kind==='mirrors');
 let end=V(.004,0,.004),axes:Frame['axes']=[V(0,0,1),V(0,1),V(-1)];
 if(kind!=='one'){
  insert('B',V(.004,0,.003),zx,kind==='mirrors');end=V(.008,0,.004);axes=[V(1),V(0,1),V(0,0,1)];
 }
 d.assemblies.push({id:'Output',name:'Output',kind:'target',parentId:null,frame:framePose({origin:end,axes})});
 d.surfaces.push(surface('Output-Port','Output',pose(),'probe'));
 // Preserve useful geometric metadata, independent of phase / η calculations.
 d.source.frame=pose();d.source.radius=20e-6;p.sourceBody=null;p.targetBody=null;
 return ProjectSchema.parse(p);
}
