import {fiberLensFiberProject} from '../authoring/starter';
import {ProjectSchema} from '../project/model';
import {withPortDevice} from '../routing/model';
import {defaultRouting} from '../routing/contract';
import {pose} from '../surface/model';
/** Explicit large-aperture folded task; not a pre-optimized design or catalog part. */
export function lensDesignExample(){
 const p=withPortDevice(fiberLensFiberProject(),'target','pic-edge');if(p.model.kind!=='surface')throw Error('Physical Project required.');
 const d=p.model.prescription,out=d.surfaces.pop()!;
 d.name='Fiber → Lens → 2 Mirrors → PIC · Lens Design';
 d.assemblies.find(a=>a.id===out.assemblyId)!.frame=pose(.01,0,.002);
 d.assemblies.push({id:'Relay-Fold-1',name:'Mirror 1',kind:'mirror',parentId:null,frame:pose(.006,0,0,Math.PI,-Math.PI/4)},{id:'Relay-Fold-2',name:'Mirror 2',kind:'mirror',parentId:null,frame:pose(.006,0,.002,0,Math.PI/4)});
 for(const [i,id]of ['Relay-Fold-1','Relay-Fold-2'].entries()){
  d.surfaces.push({...out,id:`Relay-M${i+1}`,name:`Mirror ${i+1}`,assemblyId:id,frame:pose(),shape:'plane',radius:0,aperture:.001,interaction:'reflect',nBefore:1,nAfter:1,materialBefore:'air',materialAfter:'air'});
  p.bodies.push({assemblyId:id,kind:'mirror',outline:'disc',width:.0022,height:.0022,thickness:.00005});
 }
 d.surfaces.push(out);p.routing=defaultRouting();return ProjectSchema.parse(p);
}
