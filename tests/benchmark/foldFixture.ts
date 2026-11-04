import {benchmarkFixture} from './fixture';
import {emptyTrain} from '../../src/synthesis/construction';
import {prepareRoutingDomain,buildRouteProposal,type RouteProposal} from '../../src/routing/search';
import {V} from '../../src/surface/model';
// D2.7 fixture, extracted without numerical changes for D2.8-A reuse.
export function angleFixture(offset:number,degrees:number,clear=200e-6){
 const f=benchmarkFixture(offset),base=emptyTrain(f.project,f.problem);base.routing=f.routing;
 const options={...f.problem.routes,clearRadius:clear,prismLeg:4*clear,mirrorThickness:20e-6};
 const domain=prepareRoutingDomain(base,options,0),theta=degrees*Math.PI/180,dx=Math.abs(offset)/Math.tan(theta),a=V(.005-dx/2),b=V(.005+dx/2,0,offset),middle=V(Math.cos(theta),0,Math.sign(offset)*Math.sin(theta));
 const proposal:RouteProposal={topology:'mirror2',blocks:[{kind:'mirror',at:a,incoming:V(1),outgoing:middle},{kind:'mirror',at:b,incoming:middle,outgoing:V(1)}]};
 return {...buildRouteProposal(domain,options,proposal),options,domain,fixture:f};
}
