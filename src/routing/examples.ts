import {fiberLensFiberProject} from '../authoring/starter';
import {withPortDevice} from './model';
import {ProjectSchema} from '../project/model';
import type {Project} from '../project/model';
import {pose} from '../surface/model';
import type {Surface,Assembly} from '../surface/model';
import {materialIndex} from '../surface/materials';
import {defaultRouting} from './contract';
export type RoutingExample='mirrors'|'prism';
/** Explicit manual prescriptions, not auto-generated or mode-matched solutions. */
export function routingExample(which:RoutingExample):Project {
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
