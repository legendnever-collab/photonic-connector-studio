import {basicRelayReference} from '../../src/authoring/basicRelay';
import {framePose} from '../../src/authoring/commands';
import {portWorld,withPortWorld} from '../../src/routing/model';
import {defaultProblem} from '../../src/design/engine';
import {defaultRouting} from '../../src/routing/contract';
import {defaultSynthesis} from '../../src/synthesis/contract';
import {modes,prescription} from '../../src/project/model';
import type {Project} from '../../src/project/model';

export const FIXTURE_VERSION='golden-001/1';
export const OFFSETS=[0,50e-6,-50e-6,100e-6,500e-6] as const;
// Same construction, Mode, frames and budgets as D2.6.1's 500 µm regression.
// The Output roll=π belongs to that fixture; optical propagation axis is +X.
export function benchmarkFixture(offset:number){
 let project=basicRelayReference();const target=framePose(portWorld(project,'target'));
 target.origin.z=offset;project=withPortWorld(project,'target',target);
 const problem={...defaultProblem(project),maxParts:4,maxGenerated:4};
 const routing=defaultRouting(),options=defaultSynthesis();
 return {project,problem,routing,options};
}
export function fixedPorts(p:Project){
 const d=prescription(p);return JSON.parse(JSON.stringify({wavelength:d.wavelength,sourceFrame:portWorld(p,'source'),targetFrame:portWorld(p,'target'),
  modes:modes(p),authoring:p.authoring?.ports,source:d.source,target:d.surfaces.at(-1),sourceBody:p.sourceBody,targetBody:p.targetBody}));
}
