import {test,expect} from 'vitest';
import {assessJoint,defaultJointTolerance} from '../src/design/joint';
import {jointReport,jointReportLine} from '../src/design/jointReport';
import {fiberLensFiberProject} from '../src/authoring/starter';
import {defaultProblem,problemProject} from '../src/design/engine';
import {defaultRouting} from '../src/routing/contract';
import {serializeProject,parseProject,prescription} from '../src/project/model';
function fixture(){const p=fiberLensFiberProject(),o=defaultJointTolerance(p);o.samples=o.maxCases=8;o.mating.position=[0,.25e-6,.25e-6];return problemProject(p,{...defaultProblem(p),jointTolerance:o},p.routing??defaultRouting());}
test('report exports the exact evaluated input, declared bounds and sample domains without changing Project state',async()=>{
 const p=fixture(),before=serializeProject(p),r=await assessJoint(p,p.designProblem!.jointTolerance!),report=jointReport(p,r);
 expect(report.state).toBe('current');expect(report.result).toEqual(r);expect(report.result!.inputSignature).toBe(before);expect(report.settings).toEqual(p.designProblem!.jointTolerance);expect(report.result!.observations).toHaveLength(8);
 expect(jointReportLine(report)).toContain(`field ${r.fieldAssessed}/8`);expect(jointReportLine(report)).toContain('no Yield claim');expect(serializeProject(p)).toBe(before);
 const loaded=parseProject(before);expect(jointReport(loaded,r).state).toBe('current');expect(jointReport(loaded,null).state).toBe('not-calculated');expect(JSON.parse(before)).not.toHaveProperty('jointResult');
});
test('geometry, Mode, settings, routing and invalid drafts suppress old observations; exact Undo restores validity',async()=>{
 const p=fixture(),r=await assessJoint(p,p.designProblem!.jointTolerance!);
 const changes=[(q:typeof p)=>{prescription(q).assemblies[0].frame.origin.y+=1e-6;},(q:typeof p)=>{if(q.model.kind==='surface')q.model.sourceMode.mfdX=q.model.sourceMode.mfdX!*1.1;},(q:typeof p)=>{q.designProblem!.jointTolerance!.seed++;},(q:typeof p)=>{q.routing!.positionTolerance*=2;}];
 for(const mutate of changes){const q=structuredClone(p);mutate(q);const report=jointReport(q,r);expect(report.state).toBe('stale');expect(report.result).toBeNull();expect(jointReportLine(report)).not.toContain('min η');}
 expect(jointReport(p,r,true).result).toBeNull();expect(jointReport(p,r).state).toBe('current');
 for(const changed of [{engine:'obsolete'},{coverage:'changed'},{settings:'{}'}])expect(jointReport(p,{...r,...changed}).state).toBe('stale');
});
test('partial, cancelled, geometry failed and null field results keep coverage and cannot claim sample goals',async()=>{
 const p=fixture();p.designProblem!.jointTolerance!.maxCases=1;const cap=await assessJoint(p,p.designProblem!.jointTolerance!);expect(cap.status).toBe('partial');expect(jointReportLine(jointReport(p,cap))).toContain('partial / nominal only');expect(jointReport(p,cap).result!.meetsSampleGoals).toBe(false);
 const cancel=await assessJoint(p,p.designProblem!.jointTolerance!,{cancelled:()=>true});expect(jointReportLine(jointReport(p,cancel))).toContain('cancelled');expect(cancel.meetsSampleGoals).toBe(false);
 p.designProblem!.jointTolerance!.maxCases=8;p.designProblem!.jointTolerance!.assembly.position=[0,1e-6,0];const unsupported=await assessJoint(p,p.designProblem!.jointTolerance!);const report=jointReport(p,unsupported);expect(report.state).toBe('current');expect(report.result!.fieldAssessed).toBeLessThan(8);expect(report.result!.observations.some(o=>o.eta===null)).toBe(true);expect(report.result!.meetsSampleGoals).toBe(false);
 p.designProblem!.jointTolerance!.assembly.position=[0,0,0];p.routing!.positionTolerance=1e-9;const failed=await assessJoint(p,p.designProblem!.jointTolerance!);expect(failed.geometryPassed).toBeLessThan(8);expect(jointReport(p,failed).result!.meetsSampleGoals).toBe(false);
});
test('unsaved dialog assessment becomes current only after the same effective settings are committed',async()=>{
 const original=fiberLensFiberProject(),p=fixture(),r=await assessJoint(p,p.designProblem!.jointTolerance!);expect(jointReport(original,r).state).toBe('stale');expect(jointReport(parseProject(serializeProject(p)),r).state).toBe('current');
});
