import {sharedRelayReference} from './arrayReference';
import {ProjectSchema} from '../project/model';
/** Reuses the existing validated thick-Lens construction. No new solver. */
export function basicRelayReference(){const p=sharedRelayReference();delete p.portArrays;delete p.arrayStudy;p.designScenario='basic-relay';if(p.model.kind!=='surface')throw Error('Physical Project required');p.model.prescription.name='01 · Fiber → Lens → Lens → Fiber';let lens=0;p.model.prescription.assemblies=p.model.prescription.assemblies.map(a=>({...a,name:a.kind==='lens'?`BK7 Lens ${++lens}`:a.name}));p.targetBody={radius:62.5e-6,length:.001};return ProjectSchema.parse(p);}
