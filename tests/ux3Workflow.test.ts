import {test,expect} from 'vitest';
import {basicRelayReference} from '../src/authoring/basicRelay';
import {withPortWorld,portWorld} from '../src/routing/model';
import {framePose} from '../src/authoring/commands';
import {searchSynthesis,applySynthesis} from '../src/synthesis/engine';
import {defaultSynthesis} from '../src/synthesis/contract';
import {defaultProblem} from '../src/design/engine';
import {defaultRouting} from '../src/routing/contract';
import {serializeProject} from '../src/project/model';
test('500 um displaced Output remains the fixed goal during real synthesis, preview and Apply',()=>{
 const base=basicRelayReference(),target=framePose(portWorld(base,'target'));target.origin.y=.0005;const p=withPortWorld(base,'target',target),before=serializeProject(p),o={...defaultSynthesis(),families:['mirror2'] as ('mirror2')[],budget:2048,geometryBudget:32,fitBudget:256};
 const r=searchSynthesis(p,{...defaultProblem(p),maxParts:4,maxGenerated:4},defaultRouting(),o);
 expect(serializeProject(p)).toBe(before);const c=r.candidates.find(c=>c.qualified);expect(c).toBeDefined();if(!c)throw Error(r.reason);const next=applySynthesis(p,r,c.id);expect(portWorld(next,'source')).toEqual(portWorld(p,'source'));expect(portWorld(next,'target')).toEqual(portWorld(p,'target'));expect(next.model).not.toEqual(p.model);
},60000);
