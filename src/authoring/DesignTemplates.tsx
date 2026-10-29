import {useEffect,useRef,useState} from 'react';
import {newPhysicalProject} from './commands';
import {defaultPortArrays} from '../project/portArrays';
import {withPortWorld,withPortDevice} from '../routing/model';
import {pose} from '../surface/model';
import {ProjectSchema} from '../project/model';
import {defaultRouting} from '../routing/contract';
import {useProject} from '../project/Store';
export const DESIGN_TEMPLATES=[
 {id:'edge-direct',category:'edge',name:'Edge Coupling · 같은 광축 연결',description:'마주 보는 Input Fiber와 Output Edge Port · 1 × 8 Array',assembly:'fixed'},
 {id:'edge-receptacle',category:'edge',name:'Edge Coupling · 수직 삽입 Receptacle',description:'수직 조립과 최종 Edge Interface를 분리해 정의 · Fold는 설계 중 구성',assembly:'vertical-insertion'},
 {id:'vertical',category:'vertical',name:'Vertical Coupling · 상부 입사',description:'상부에서 PIC Coupler로 연결 · 실제 Receiving Field와 입사 조건은 사용자 정의',assembly:'fixed'},
 {id:'evanescent',category:'evanescent',name:'Evanescent Coupling · 근접 연결',description:'Port Array 배치 시작점 · 전용 field 모델 및 효율 계산 미지원',assembly:'fixed'},
] as const;
export function designTemplate(id:string){const t=DESIGN_TEMPLATES.find(t=>t.id===id);if(!t)throw Error('Unknown Design Template');let p=newPhysicalProject();
 p=withPortDevice(p,'target',t.category==='vertical'?'pic-grating':t.category==='edge'?'pic-edge':'custom');
 p=withPortWorld(p,'target',t.category==='vertical'?pose(.01,0,.005,0,-Math.PI/2):pose(.01,0,t.id==='edge-receptacle'?.005:0));
 const a=defaultPortArrays();a.source.cols=a.target.cols=8;a.interface=t.category;a.assembly=t.assembly;
 if(p.model.kind==='surface')p={...p,model:{...p.model,prescription:{...p.model.prescription,name:t.name}},portArrays:a,routing:{...defaultRouting(),parts:{lens:2,mirror:2,prism:2}}};
 return ProjectSchema.parse(p);
}
export default function DesignTemplates({onClose,onOpened}:{onClose:()=>void;onOpened:()=>void}){const s=useProject(),dialog=useRef<HTMLDialogElement>(null),[category,setCategory]=useState<'edge'|'vertical'|'evanescent'>('edge');
 useEffect(()=>{const opener=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>opener?.focus();},[]);
 return <dialog ref={dialog} className="insert-dialog design-templates" aria-label="Templates" onCancel={e=>{e.preventDefault();onClose();}}><header><h2>Templates · 설계 상황 선택</h2><button aria-label="Close Templates" onClick={onClose}>×</button></header><p>선택하면 Port·Array·조립 조건을 가진 새 설계를 엽니다. 광학 부품이나 완성된 답을 삽입하지 않습니다.</p><nav className="problem-tabs">{(['edge','vertical','evanescent'] as const).map(k=><button key={k} aria-pressed={category===k} onClick={()=>setCategory(k)}>{k==='edge'?'Edge Coupling':k==='vertical'?'Vertical Coupling':'Evanescent Coupling'}</button>)}</nav>{DESIGN_TEMPLATES.filter(t=>t.category===category).map(t=><article key={t.id}><h3>{t.name}</h3><p>{t.description}</p><small>가정 치수 · Output Mode / PIC 효율은 미정의 · 편집 가능한 시작 조건</small><button onClick={()=>{s.requestReplace(designTemplate(t.id));onOpened();onClose();}}>이 조건으로 시작 · {t.name}</button></article>)}<footer><button onClick={onClose}>닫기</button></footer></dialog>;
}
