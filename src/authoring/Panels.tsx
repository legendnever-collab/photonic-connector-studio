import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode, PointerEvent as ReactPointerEvent } from 'react';
type PanelState={mode:'dock'|'float'|'closed';x:number;y:number;width:number;height:number};
type Session={dataHeight:number;panels:Record<string,PanelState>};
const defaults=():Session=>({dataHeight:260,panels:{data:{mode:location.hash?'dock':'closed',x:250,y:330,width:800,height:330},inspector:{mode:location.hash?'dock':'closed',x:850,y:180,width:350,height:560},explorer:{mode:'closed',x:240,y:180,width:420,height:620}}});
function read():Session {
 try {
  const v=JSON.parse(localStorage.getItem('pcs-ux3-windows')??'null'),d=defaults();
  if(v&&Number.isFinite(v.dataHeight)) {
   d.dataHeight=Math.min(600,Math.max(160,v.dataHeight));
   for(const id of ['data','inspector','explorer']) {
    const p=v.panels?.[id];
    if(p&&['dock','float','closed'].includes(p.mode)&&['x','y','width','height'].every(k=>Number.isFinite(p[k])))
     d.panels[id]={...p,x:Math.max(0,Math.min(p.x,innerWidth-300)),y:Math.max(0,Math.min(p.y,innerHeight-100)),width:Math.max(300,Math.min(innerWidth,p.width)),height:Math.max(160,Math.min(innerHeight,p.height))};
   }
  }
  return d;
 }catch{return defaults();}
}
const Context=createContext<{session:Session;setSession:React.Dispatch<React.SetStateAction<Session>>}|null>(null);
export function PanelProvider({children}:{children:ReactNode}){const [session,setSession]=useState(read);useEffect(()=>{try{localStorage.setItem('pcs-ux3-windows',JSON.stringify(session));}catch{/* Session persistence is optional under file://. */}},[session]);return <Context.Provider value={{session,setSession}}>{children}</Context.Provider>;}
function usePanels(){return useContext(Context)!;}
export function useOpenInspector(){const {setSession}=usePanels();return ()=>setSession(s=>({...s,panels:{...s.panels,inspector:{...s.panels.inspector,mode:s.panels.inspector.mode==='closed'?'dock':s.panels.inspector.mode}}}));}
export function useWorkspacePanels(){const {session,setSession}=usePanels();return {modes:session.panels,show:(id:'explorer'|'inspector')=>setSession(s=>({...s,panels:{...s.panels,[id]:{...s.panels[id],mode:s.panels[id].mode==='closed'?'dock':s.panels[id].mode}}})),close:(id:'data'|'inspector'|'explorer')=>setSession(s=>({...s,panels:{...s.panels,[id]:{...s.panels[id],mode:'closed'}}})),inspector:()=>setSession(s=>({...s,panels:{...s.panels,inspector:{...s.panels.inspector,mode:'dock'}}})),data:(mode:'dock'|'closed')=>setSession(s=>({...s,panels:{...s.panels,data:{...s.panels.data,mode}}})),focusLayout:()=>setSession(s=>({...s,panels:Object.fromEntries(Object.entries(s.panels).map(([id,p])=>[id,{...p,mode:'closed' as const}]))}))};}
export function WindowControls({onData,onRestore,onInspector,onExplorer}:{onData?:()=>void;onRestore?:()=>void;onInspector?:()=>void;onExplorer?:()=>void}){const {setSession}=usePanels();return <div className="window-controls" aria-label="Windows"><button aria-label="Explorer" onClick={onExplorer}>광학계 목록</button><button aria-label="Surface Data" onClick={()=>{onData?.();setSession(s=>({...s,panels:{...s.panels,data:{...s.panels.data,mode:s.panels.data.mode==='closed'?'dock':'closed'}}}));}}>Surface Data</button><button aria-label="Properties / Analysis" onClick={()=>{onInspector?.();setSession(s=>({...s,panels:{...s.panels,inspector:{...s.panels.inspector,mode:'dock'}}}));}}>설정·결과 창</button><button aria-label="Restore Window Layout" onClick={()=>{onRestore?.();setSession(defaults());}}>기본 배치</button></div>;}
export function DockPanel({id,title,children,active=true}:{id:'data'|'inspector'|'explorer';title:string;children:ReactNode;active?:boolean}){
 const {session,setSession}=usePanels(),p=session.panels[id],ref=useRef<HTMLDivElement>(null);
 const patch=(next:Partial<PanelState>)=>setSession(s=>({...s,panels:{...s.panels,[id]:{...s.panels[id],...next}}}));
 useEffect(()=>{const el=ref.current;if(!el||p.mode!=='float')return;const observer=new ResizeObserver(()=>{const r=el.getBoundingClientRect();if(r.width>=300&&r.height>=160&&(Math.abs(r.width-p.width)>1||Math.abs(r.height-p.height)>1))patch({width:r.width,height:r.height});});observer.observe(el);return()=>observer.disconnect();},[p.mode,p.width,p.height]);
 function drag(e:ReactPointerEvent){if(p.mode!=='float'||(e.target as HTMLElement).closest('button'))return;e.preventDefault();const el=e.currentTarget as HTMLElement,start={x:e.clientX,y:e.clientY,px:p.x,py:p.y};el.setPointerCapture(e.pointerId);const move=(v:PointerEvent)=>patch({x:Math.max(0,Math.min(innerWidth-240,start.px+v.clientX-start.x)),y:Math.max(0,Math.min(innerHeight-70,start.py+v.clientY-start.y))});const up=()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);};el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);}
 return <div ref={ref} className={`dock-panel dock-${id} panel-${p.mode}`} data-testid={`panel-${id}`} hidden={p.mode==='closed'||(!active&&p.mode!=='float')} style={p.mode==='float'?{left:p.x,top:p.y,width:p.width,height:p.height}:undefined} onPointerUp={()=>{if(p.mode==='float'&&ref.current){const r=ref.current.getBoundingClientRect();if(Math.abs(r.width-p.width)>1||Math.abs(r.height-p.height)>1)patch({width:r.width,height:r.height});}}}>
 <div className="dock-title" onPointerDown={drag}><strong>{title}</strong><span>{p.mode==='float'?'Internal Window':'Docked'}</span><button aria-label={`${p.mode==='float'?'Dock':'Float'} ${title}`} onClick={()=>patch(p.mode==='float'?{mode:'dock'}:{mode:'float',width:Math.max(300,Math.min(p.width,innerWidth-p.x-12)),height:Math.max(160,Math.min(p.height,innerHeight-p.y-12))})}>{p.mode==='float'?'Dock':'Float'}</button><button aria-label={`Close ${title}`} onClick={()=>patch({mode:'closed'})}>×</button></div><div className="dock-content">{children}</div></div>;
}
export function DesignSplit({children}:{children:ReactNode}){const {session}=usePanels();return <main className="surface-main design-split" style={{'--data-height':`${session.dataHeight}px`} as React.CSSProperties}>{children}</main>;}
export function Splitter(){const {session,setSession}=usePanels(),ref=useRef<HTMLDivElement>(null);return <div ref={ref} className="design-splitter" role="separator" tabIndex={0} aria-label="Layout Surface Data Splitter" aria-orientation="horizontal" aria-valuemin={160} aria-valuemax={600} aria-valuenow={session.dataHeight} onKeyDown={e=>{if(['ArrowUp','ArrowDown','Home'].includes(e.key)){e.preventDefault();setSession(s=>({...s,dataHeight:e.key==='Home'?260:Math.max(160,Math.min(600,s.dataHeight+(e.key==='ArrowUp'?20:-20)))}));}}} onPointerDown={e=>{const start=e.clientY,height=session.dataHeight,el=e.currentTarget;e.preventDefault();el.setPointerCapture(e.pointerId);const move=(v:PointerEvent)=>setSession(s=>({...s,dataHeight:Math.max(160,Math.min(Math.min(600,innerHeight*.55),height+start-v.clientY))}));const up=()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);};el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);}}><span/></div>;}
export function ReplaceGuard(){return null;}
