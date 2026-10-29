import {applySmfReference} from '../authoring/smf';
import {lensDesignExample} from '../lens/examples';
import {defaultSynthesis} from '../synthesis/contract';
import {defaultProblem} from '../design/engine';
import {newPhysicalProject} from '../authoring/commands';
import {framePose} from '../authoring/commands';
import {withPortWorld,portWorld} from './model';
import {fiberLensFiberProject} from '../authoring/starter';
import {withPortDevice} from './model';
import {ProjectSchema} from '../project/model';
import type {Project} from '../project/model';
import {pose} from '../surface/model';
import type {Surface,Assembly} from '../surface/model';
import {materialIndex} from '../surface/materials';
import {defaultRouting} from './contract';
export type RoutingExample='mirrors'|'prism'|'search'|'lens'|'prism-mode'|'prism-synthesis';
/** Explicit manual prescriptions, not auto-generated or mode-matched solutions. */
export function routingExample(which:RoutingExample):Project {
 if(which==='prism-synthesis'){
  const p=withPortWorld(applySmfReference(newPhysicalProject(),'target'),'target',pose(.016,0,.012));if(p.model.kind!=='surface')throw Error('Physical');
  const d=p.model.prescription;d.name='D2.2.2 · Blank 2 Prism synthesis task';d.surfaces.at(-1)!.aperture=.004;
  p.model.sourceMode={representation:'gaussian',mfdX:.001,mfdY:.001,polarization:'TE'};p.model.targetMode={...p.model.sourceMode};p.sourceBody=null;p.targetBody=null;
  p.routing={...defaultRouting(),parts:{lens:0,mirror:0,prism:2}};
  p.designProblem={...defaultProblem(p),maxParts:2,maxGenerated:2};p.designProblem.tolerance={...p.designProblem.tolerance,portPosition:[0,0,0],portAngle:[0,0,0],componentPosition:[0,0,0],componentAngle:[0,0,0]};
  p.synthesis={...defaultSynthesis(),lensMount:'free',families:['prism2'],clearRadius:[.0015,.0015],prismLeg:[.006,.006],budget:128,geometryBudget:32,fitBudget:16};
  return ProjectSchema.parse(p);
 }
 if(which==='prism-mode'){
  const p=applySmfReference(routingExample('prism'),'target');if(p.model.kind!=='surface')throw Error('Physical');
  const d=p.model.prescription;d.name='D2.2.1 · Collimated BK7 Prism · TE';
  d.surfaces=d.surfaces.slice(2);d.assemblies=d.assemblies.filter(a=>a.kind!=='lens');p.bodies=p.bodies.filter(b=>b.kind!=='lens');
  for(const s of d.surfaces){s.frame.origin.x*=25;s.frame.origin.y*=25;s.aperture=.003;}
  d.assemblies.find(a=>a.kind==='prism')!.frame=pose(.003,0,0,0,0,Math.PI/2);
  d.assemblies.find(a=>a.kind==='target')!.frame=pose(.004,0,.004,0,-Math.PI/2);d.source.frame=pose();
  p.bodies.forEach(b=>{if(b.kind==='prism')b.depth=.006;});p.sourceBody=null;p.targetBody=null;delete p.routing;
  p.model.sourceMode={representation:'gaussian',mfdX:.0004,mfdY:.0005,polarization:'TE'};p.model.targetMode={...p.model.sourceMode};
  return ProjectSchema.parse(p);
 }
 if(which==='lens')return lensDesignExample();
 if(which==='search'){let p=routingExample('mirrors');p=withPortWorld(p,'target',{...framePose(portWorld(p,'target')),origin:{x:.01,y:80e-6,z:50e-6}});if(p.model.kind==='surface')p={...p,model:{...p.model,prescription:{...p.model.prescription,name:'Fiber → displaced PIC · S2 routing task'}}};return p;}
 let p=withPortDevice(fiberLensFiberProject(),'target',which==='mirrors'?'pic-edge':'pic-grating');
 if(p.model.kind!=='surface')throw Error('Physical example required');
 const d=p.model.prescription,n=materialIndex('N-BK7',d.wavelength),z=-10e-6;
 const lens=d.assemblies[0],front=d.surfaces[0],rear=d.surfaces[1],output=d.surfaces.at(-1)!;
 const make=(id:string,assemblyId:string,frame:Surface['frame'],interaction:Surface['interaction'],nBefore=1,nAfter=1):Surface=>({id,name:id,assemblyId,frame,shape:'plane',radius:.005,aperture:30e-6,interaction,nBefore,nAfter,materialBefore:nBefore===1?'air':'N-BK7',materialAfter:nAfter===1?'air':'N-BK7',outsideIndex:1,array:null});
 let assemblies:Assembly[]=[{...lens,frame:pose(.0015,0,z)}],surfaces:Surface[]=[{...front,aperture:150e-6},{...rear,aperture:150e-6,frame:pose(.0005)}];
 const bodies:Project['bodies']=[{assemblyId:lens.id,kind:'lens',outerRadius:200e-6}];
 if(which==='mirrors'){
  assemblies.push({id:'Fold-1',name:'Mirror 1 · +X to +Z',kind:'mirror',parentId:null,frame:pose(.004,0,z,0,Math.PI/4)},{id:'Fold-2',name:'Mirror 2 · +Z to +X',kind:'mirror',parentId:null,frame:pose(.004,0,50e-6,0,Math.PI/4)},{id:'Output',name:'PIC Edge Coupler',kind:'target',parentId:null,frame:pose(.01,0,50e-6)});
  surfaces.push(make('M1','Fold-1',pose(),'reflect'),make('M2','Fold-2',pose(),'reflect'),{...output,frame:pose(),aperture:30e-6,name:'PIC Free-space Reference'});
  bodies.push(...['Fold-1','Fold-2'].map(assemblyId=>({assemblyId,kind:'mirror' as const,outline:'disc' as const,width:65e-6,height:65e-6,thickness:5e-6})));
 }else{
  // Local +Y becomes global +Z. Three finite planes form one extruded right-angle Prism.
  assemblies.push({id:'Fold-Prism',name:'BK7 TIR Prism · +X to +Z',kind:'prism',parentId:null,frame:pose(.004,0,z,0,0,Math.PI/2)},{id:'Output',name:'PIC Grating Coupler',kind:'target',parentId:null,frame:pose(.00404,0,50e-6,0,-Math.PI/2)});
  surfaces.push(make('P-entry','Fold-Prism',pose(),'refract',1,n),make('P-TIR','Fold-Prism',pose(40e-6,0,0,-Math.PI/4),'tir',n,n),make('P-exit','Fold-Prism',pose(40e-6,40e-6,0,Math.PI/2),'refract',n,1),{...output,frame:pose(),aperture:30e-6,name:'PIC Free-space Reference'});
  bodies.push({assemblyId:'Fold-Prism',kind:'prism',depth:60e-6});
 }
 p={...p,model:{...p.model,prescription:{...d,name:which==='mirrors'?'Fiber → Lens → 2 Mirrors → PIC':'Fiber → Lens → TIR Prism → PIC',source:{...d.source,frame:pose(0,0,z),radius:5e-6},assemblies,surfaces}},bodies,routing:{...defaultRouting(),bounds:{min:{x:.001,y:-.0003,z:-.0003},max:{x:.005,y:.0003,z:.0003}}}};
 return ProjectSchema.parse(p);
}
