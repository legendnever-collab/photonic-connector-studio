import { PanelProvider } from './authoring/Panels';
import { useEffect, useState } from 'react';
import SurfaceWorkbench from './surface/Workbench';
import type { Theme } from './Appearance';
export default function App(){
 const [theme,setTheme]=useState<Theme>('light');
 useEffect(()=>{const v=window.visualViewport;const resize=()=>{document.documentElement.style.setProperty('--visible-height',`${v?.height??innerHeight}px`);document.documentElement.style.setProperty('--visible-top',`${v?.offsetTop??0}px`);};resize();v?.addEventListener('resize',resize);v?.addEventListener('scroll',resize);return()=>{v?.removeEventListener('resize',resize);v?.removeEventListener('scroll',resize);};},[]);
 return <PanelProvider><SurfaceWorkbench theme={theme} setTheme={setTheme}/></PanelProvider>;
}
