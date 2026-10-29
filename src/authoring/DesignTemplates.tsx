import {useEffect,useRef,useState} from 'react';
import {newPhysicalProject} from './commands';
import {defaultPortArrays} from '../project/portArrays';
import {withPortWorld,withPortDevice} from '../routing/model';
import {pose} from '../surface/model';
import {ProjectSchema} from '../project/model';
import {defaultRouting} from '../routing/contract';
import {useProject} from '../project/Store';
import {DESIGN_SCENARIOS} from './designScenarios';
import {mirrorArrayReference,sharedRelayReference} from './arrayReference';
export const DESIGN_TEMPLATES=[
 {id:'edge-direct',category:'edge',name:'Edge Coupling · 같은 광축 연결',description:'마주 보는 Input Fiber와 Output Edge Port · 1 × 8 Array',assembly:'fixed'},
 {id:'edge-receptacle',category:'edge',name:'Edge Coupling · 수직 삽입 Receptacle',description:'수직 조립과 최종 Edge Interface를 분리해 정의 · Fold는 설계 중 구성',assembly:'vertical-insertion'},
 {id:'vertical',category:'vertical',name:'Vertical Coupling · 상부 입사',description:'상부에서 PIC Coupler로 연결 · 실제 Receiving Field와 입사 조건은 사용자 정의',assembly:'fixed'},
 {id:'spacer-fold',category:'vertical',name:'Vertical Coupling · Spacer 내부 Fold',description:'Fiber 경사면과 Spacer 내부 광경로를 설계하는 시작 조건',assembly:'fixed'},
 {id:'evanescent',category:'evanescent',name:'Evanescent Coupling · 근접 연결',description:'Port Array 배치 시작점 · 전용 field 모델 및 효율 계산 미지원',assembly:'fixed'},
] as const;
export function designTemplate(id:string){const t=DESIGN_TEMPLATES.find(t=>t.id===id);if(!t)throw Error('Unknown Design Template');let p=newPhysicalProject();
 p=withPortDevice(p,'target',t.id==='spacer-fold'?'custom':t.category==='vertical'?'pic-grating':t.category==='edge'?'pic-edge':'custom');
 p=withPortWorld(p,'target',t.category==='vertical'?pose(.01,0,.005,0,-Math.PI/2):pose(.01,0,t.id==='edge-receptacle'?.005:0));
 const a=defaultPortArrays();a.source.cols=a.target.cols=8;a.interface=t.category;a.assembly=t.assembly;
 if(t.id==='spacer-fold'){a.source.pitchY=a.target.pitchY=127e-6;p=withPortWorld(p,'target',pose(.01,0,.001,0,-Math.PI/2));}
 if(p.model.kind==='surface')p={...p,designScenario:t.id,model:{...p.model,prescription:{...p.model.prescription,name:t.name}},portArrays:a,routing:{...defaultRouting(),parts:{lens:2,mirror:2,prism:2}}};
 return ProjectSchema.parse(p);
}
export default function DesignTemplates({onClose,onOpened}:{onClose:()=>void;onOpened:()=>void}){const s=useProject(),dialog=useRef<HTMLDialogElement>(null),[category,setCategory]=useState<'edge'|'vertical'|'evanescent'>('edge');
 useEffect(()=>{const opener=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>opener?.focus();},[]);
 return <dialog ref={dialog} className="insert-dialog design-templates" aria-label="Templates" onCancel={e=>{e.preventDefault();onClose();}}><header><h2>Templates · 설계 상황 선택</h2><button aria-label="Close Templates" onClick={onClose}>×</button></header><p>상황별 시작 조건과 필요한 광학 기능을 확인하세요. 참고 자료의 구조와 연습용 가정을 함께 표시합니다.</p><nav className="problem-tabs">{(['edge','vertical','evanescent'] as const).map(k=><button key={k} aria-pressed={category===k} onClick={()=>setCategory(k)}>{k==='edge'?'Edge Coupling':k==='vertical'?'Vertical Coupling':'Evanescent Coupling'}</button>)}</nav>{DESIGN_TEMPLATES.filter(t=>t.category===category).map(t=>{const r=DESIGN_SCENARIOS[t.id];return <article key={t.id}><h3>{t.name}</h3><p>{r.path}</p><details><summary>구성·가정·참고 자료</summary><p>{r.roles}</p><p>{r.assumptions}</p><p>{r.check}</p><small>{r.reference}</small></details><small>Port 조건만 생성 · 광학 부품과 PIC Field는 설계 중 정의</small><button onClick={()=>{s.requestReplace(designTemplate(t.id));onOpened();onClose();}}>이 조건으로 시작 · {t.name}</button></article>;})}{category==='edge'&&<article><h3>계산 연습 · 공용 2-Lens Relay</h3><p>{DESIGN_SCENARIOS['relay-reference'].path}</p><details><summary>구성·가정·참고 자료</summary><p>{DESIGN_SCENARIOS['relay-reference'].roles}</p><p>{DESIGN_SCENARIOS['relay-reference'].assumptions}</p><p>{DESIGN_SCENARIOS['relay-reference'].check}</p><small>{DESIGN_SCENARIOS['relay-reference'].reference}</small></details><small>실제 Lens 2개 포함 · 대표 Channel 정합 / 외곽 Channel 검증 연습</small><button onClick={()=>{s.requestReplace(sharedRelayReference());onOpened();onClose();}}>계산 예시 열기 · 공용 2-Lens Relay</button></article>}{category==='vertical'&&<article><h3>계산 연습 · Mirror 방향 전환</h3><p>{DESIGN_SCENARIOS['mirror-reference'].path}</p><details><summary>구성·가정·참고 자료</summary><p>{DESIGN_SCENARIOS['mirror-reference'].roles}</p><p>{DESIGN_SCENARIOS['mirror-reference'].assumptions}</p><small>{DESIGN_SCENARIOS['mirror-reference'].reference}</small></details><small>실제 Reflect Surface 포함 · 합성 Gaussian 기준 · 제품 효율 아님</small><button onClick={()=>{s.requestReplace(mirrorArrayReference());onOpened();onClose();}}>계산 예시 열기 · Mirror 방향 전환</button></article>}<footer><button onClick={onClose}>닫기</button></footer></dialog>;
}
