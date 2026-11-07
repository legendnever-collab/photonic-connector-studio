import {expect} from 'vitest';
import {bodyGeometry} from '../../src/project/geometry';
import {prescription} from '../../src/project/model';
import type {Project} from '../../src/project/model';
import {compile} from '../../src/surface/model';
import type {Frame,Vec} from '../../src/surface/model';

export type XYZ=[number,number,number];
export type RigidError={position:XYZ;angle:XYZ};
export type LensMotion=RigidError & {id:string;frame:'local'|'world';pivot:Vec};
const xyz=({x,y,z}:Vec):XYZ=>[x,y,z];
const matrixVector=(rows:XYZ[],v:XYZ):XYZ=>rows.map(row=>row.reduce((sum,x,i)=>sum+x*v[i],0)) as XYZ;

// Independent closed-form matrix for Rz(yaw) Ry(pitch) Rx(roll).
function rotation([roll,pitch,yaw]:XYZ):XYZ[]{
  const [a,b,c]=[roll,pitch,yaw].map(Math.cos);
  const [u,v,w]=[roll,pitch,yaw].map(Math.sin);
  return [[c*b,c*v*u-w*a,c*v*a+w*u],[w*b,w*v*u+c*a,w*v*a-c*u],[-v,b*u,b*a]];
}

const transpose=(m:XYZ[]):XYZ[]=>[0,1,2].map(j=>m.map(row=>row[j]) as XYZ);
const difference=(a:XYZ,b:XYZ)=>Math.hypot(...a.map((x,i)=>x-b[i]));

function oracle(m:LensMotion,front:Frame){
  const R=rotation(m.angle);
  const worldToLocal=front.axes.map(xyz),localToWorld=transpose(worldToLocal);
  const local=m.frame==='local';
  const rotate=(v:XYZ)=>local
    ?matrixVector(localToWorld,matrixVector(R,matrixVector(worldToLocal,v)))
    :matrixVector(R,v);
  const pivot=xyz(m.pivot);
  const translation=local?matrixVector(localToWorld,m.position):m.position;
  return {
    vector:(v:Vec)=>rotate(xyz(v)),
    point:(v:Vec)=>rotate(xyz(v).map((x,i)=>x-pivot[i]) as XYZ).map((x,i)=>x+pivot[i]+translation[i]) as XYZ,
  };
}

// Same frame comparison precision as tests/jointTolerance.test.ts. This is a
// numerical verification tolerance for coordinates and unit vectors only.
export const RIGID_CHECK_TOLERANCE=1e-12;

export function checkRigidMotion(before:Project,after:Project,motions:LensMotion[]){
  const d=prescription(before),next=prescription(after),a=compile(d),b=compile(next);
  expect(next.surfaces).toEqual(d.surfaces);
  expect(after.bodies).toEqual(before.bodies);
  const initial=bodyGeometry(d,a,before.bodies),moved=bodyGeometry(next,b,after.bodies);
  expect(initial.issues).toEqual([]);
  expect(moved.issues).toEqual([]);
  const transforms=new Map(motions.map(m=>[m.id,oracle(m,a.find(s=>s.assemblyId===m.id)!.world)]));
  let maxPositionM=0,maxAxisResidual=0;
  for(const [i,s] of a.entries()){
    const transform=transforms.get(s.assemblyId),t=b[i];
    maxPositionM=Math.max(maxPositionM,difference(xyz(t.world.origin),transform?.point(s.world.origin)??xyz(s.world.origin)));
    s.world.axes.forEach((v,j)=>{
      maxAxisResidual=Math.max(maxAxisResidual,difference(xyz(t.world.axes[j]),transform?.vector(v)??xyz(v)));
    });
  }
  expect(moved.solids.map(s=>s.body.assemblyId)).toEqual(initial.solids.map(s=>s.body.assemblyId));
  let checkedBodyVertices=0;
  for(const [i,solid] of initial.solids.entries()){
    const transform=transforms.get(solid.body.assemblyId),faces=moved.solids[i].faces;
    expect(faces.map(face=>face.length)).toEqual(solid.faces.map(face=>face.length));
    solid.faces.forEach((face,j)=>face.forEach((v,k)=>{
      maxPositionM=Math.max(maxPositionM,difference(xyz(faces[j][k]),transform?.point(v)??xyz(v)));
      checkedBodyVertices++;
    }));
  }
  expect(maxPositionM).toBeLessThan(RIGID_CHECK_TOLERANCE);
  expect(maxAxisResidual).toBeLessThan(RIGID_CHECK_TOLERANCE);
  return {maxPositionM,maxAxisResidual,checkedBodyVertices};
}
