import {ProjectSchema} from './model';
import type {Project} from './model';
import {defaultPortArrays} from './portArrays';
import type {PortGrid} from './portArrays';
import {portWorld,withPortWorld} from '../routing/model';
import {framePose} from '../authoring/commands';
import {pointToWorld,V} from '../surface/model';
/** A reference selection changes the modeled channel, not the assembled array placement.
 * Pitch edits are anchored at the selected channel; counts can clamp a removed reference. */
export function withPortGrid(p:Project,which:'source'|'target',raw:PortGrid){
 const a=p.portArrays??defaultPortArrays(p),old=a[which],g={...raw,referenceRow:Math.min(raw.referenceRow,raw.rows-1),referenceCol:Math.min(raw.referenceCol,raw.cols-1)};
 let next=p;
 if(g.referenceRow!==old.referenceRow||g.referenceCol!==old.referenceCol){const f=portWorld(p,which);next=withPortWorld(p,which,{...framePose(f),origin:pointToWorld(f,V(0,(g.referenceCol-old.referenceCol)*old.pitchY,(g.referenceRow-old.referenceRow)*old.pitchZ))});}
 const arrays={...a,[which]:g};
 if(arrays.source.rows*arrays.source.cols!==arrays.target.rows*arrays.target.cols||arrays.source.referenceRow*arrays.source.cols+arrays.source.referenceCol!==arrays.target.referenceRow*arrays.target.cols+arrays.target.referenceCol)arrays.mapping='unassigned';
 return ProjectSchema.parse({...next,portArrays:arrays});
}
