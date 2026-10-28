import {newPhysicalProject} from './commands';
import {applySmfReference} from './smf';
import {ProjectSchema} from '../project/model';
import {defaultPortArrays} from '../project/portArrays';
import {defaultArrayStudy} from '../project/arrayStudy';
import {withPortWorld,withPortDevice} from '../routing/model';
import {pose} from '../surface/model';
import {addLenses} from '../synthesis/construction';
import {defaultSynthesis} from '../synthesis/contract';
/** Solvable synthetic teaching reference; not a reverse-engineered vendor product. */
export function mirrorArrayReference(){
 let p=applySmfReference(newPhysicalProject(),'target');
 p=withPortDevice(withPortDevice(p,'source','custom'),'target','custom');
 p=withPortWorld(p,'target',pose(.0005,0,.0005,0,-Math.PI/2));
 if(p.model.kind!=='surface')throw Error('Physical Project required');
 const d=p.model.prescription,out=d.surfaces[0],a=defaultPortArrays();a.source.cols=a.target.cols=8;a.interface='vertical';a.assembly='fixed';
 return ProjectSchema.parse({...p,designScenario:'mirror-reference',portArrays:a,arrayStudy:{...defaultArrayStudy(),outputRoll:.001},sourceBody:null,targetBody:null,
  bodies:[{assemblyId:'Shared-Mirror',kind:'mirror',outline:'rectangle',width:.006,height:.002,thickness:.0001}],
  model:{...p.model,sourceMode:{...p.model.sourceMode,mfdX:60e-6,mfdY:60e-6},targetMode:{...p.model.targetMode,mfdX:60e-6,mfdY:60e-6},prescription:{...d,name:'Mirror 방향 전환 · 공용 평면 Mirror 근사',source:{...d.source,radius:30e-6},assemblies:[{id:'Shared-Mirror',name:'공용 45° Mirror · 개별 Mirror Array 아님',kind:'mirror',parentId:null,frame:pose(.0005,0,0,0,Math.PI/4)},...d.assemblies],surfaces:[{...out,id:'Shared-Reflector',name:'Shared planar reflector',assemblyId:'Shared-Mirror',frame:pose(),interaction:'reflect',aperture:.003,nBefore:1,nAfter:1,outsideIndex:1}, {...out,aperture:.003}]}}});
}
/** Existing thick-Lens construction supplies an on-axis relay; Array edge
 * channels are deliberately re-evaluated, never certified by that seed. */
export function sharedRelayReference(){
 let p=withPortWorld(applySmfReference(newPhysicalProject(),'target'),'target',pose(.01,0,0,0,0,Math.PI));
 p=addLenses(p,2,.001,{...defaultSynthesis(),thickness:[.001,.001]});
 const a=defaultPortArrays();a.source.cols=a.target.cols=8;a.source.referenceCol=a.target.referenceCol=3;a.source.pitchY=a.target.pitchY=127e-6;a.interface='edge';a.assembly='fixed';
 if(p.model.kind!=='surface')throw Error('Physical Project required');
 p.model.prescription.name='2-Lens Relay · 공용 Lens의 외곽 Channel 확인';
 p.model.prescription.source.radius=4.6e-6;
 return ProjectSchema.parse({...p,designScenario:'relay-reference',portArrays:a,arrayStudy:{...defaultArrayStudy(),outputPitchY:.2e-6}});
}
