import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
async function appearance(page:Page,name:string){await page.getByRole('button',{name:'Appearance',exact:true}).click();await page.getByRole('button',{name,exact:true}).click();await page.getByRole('button',{name:'Apply & Close',exact:true}).click();
 // Measure settled theme colors, rather than a frame inside the 120 ms background transition.
 await page.evaluate(async()=>{await Promise.allSettled(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished));});
}
test('appearance options preserve optical state, geometry nodes, zoom and edited parameters',async({page},info)=>{
 await page.goto('/');await page.getByLabel('Synthetic Example',{exact:true}).selectOption('pointing');await page.getByRole('button',{name:'Zoom in',exact:true}).click();
 const eta=await page.getByTestId('summary-eta').textContent();await page.evaluate(()=>{(window as any).originalSVG=document.querySelector('[data-testid="optical-canvas"]');(window as any).originalAxis=document.querySelector('[data-testid="beam-axis"]');(window as any).axisPoints=document.querySelector('[data-testid="beam-axis"]')?.getAttribute('points');});
 for(const name of ['Precision Dark','Focus Hybrid','Lab Light']){await appearance(page,name);await expect(page.getByTestId('summary-eta')).toHaveText(eta!);await expect(page.getByTestId('zoom-level')).toHaveText('125%');expect(await page.evaluate(()=>{const w=window as any;return w.originalSVG===document.querySelector('[data-testid="optical-canvas"]')&&w.originalAxis===document.querySelector('[data-testid="beam-axis"]')&&w.axisPoints===w.originalAxis.getAttribute('points');})).toBe(true);}
 if(info.project.name==='desktop'){
  await page.getByTestId('tree-fiber').click();const yaw=page.getByLabel('Yaw',{exact:true});await yaw.fill('0.2');const editedEta=await page.getByTestId('summary-eta').textContent();
  await appearance(page,'Precision Dark');await expect(yaw).toHaveValue('0.2');await expect(page.getByTestId('summary-eta')).toHaveText(editedEta!);await yaw.fill('0');await expect(yaw).toBeFocused();await expect(page.getByTestId('summary-eta')).toHaveText('100%');
 }
});
test('offline themes expose readable key text, keyboard dismissal and bounded responsive dialogs',async({page},info)=>{
 await page.context().setOffline(true);await page.goto(pathToFileURL(resolve('dist/index.html')).href);await page.getByLabel('Synthetic Example',{exact:true}).selectOption('pointing');
 const evidence:unknown[]=[];
 for(const [id,name] of [['light','Lab Light'],['dark','Precision Dark'],['hybrid','Focus Hybrid']]){
  await appearance(page,name);await expect(page.locator('.app-shell:visible')).toHaveAttribute('data-theme',id);
  const ratios=await page.evaluate(()=>{
   function luminance(rgb:string){const values=(rgb.match(/[\d.]+/g)??[]).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return values[0]*.2126+values[1]*.7152+values[2]*.0722;}
   return ['.project-strip h1','.result-summary .metric span','.result-summary .metric-coupling strong','.tree-item small','.example-bar>span','.finish-editing'].map(selector=>{const el=document.querySelector(selector)!;const style=getComputedStyle(el);let node:Element|null=el,bg='';while(node){bg=getComputedStyle(node).backgroundColor;if(bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent')break;node=node.parentElement;}const a=luminance(style.color),b=luminance(bg);return {selector,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};});
  });
  for(const entry of ratios)expect(entry.ratio,`${name}: ${entry.selector}`).toBeGreaterThanOrEqual(4.5);evidence.push({name,ratios});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/P1.3-${info.project.name}-${id}.png`,fullPage:true});
 }
 await page.getByRole('button',{name:'Appearance',exact:true}).click();const dialog=page.getByRole('dialog',{name:'더 잘 보이는 작업 공간',exact:true});await expect(dialog).toBeVisible();
 const b=await dialog.boundingBox();expect(b!.x).toBeGreaterThanOrEqual(0);expect(b!.x+b!.width).toBeLessThanOrEqual(page.viewportSize()!.width);await page.screenshot({path:`test-results/P1.3-${info.project.name}-options.png`,fullPage:true});
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(page.getByRole('button',{name:'Appearance',exact:true})).toBeFocused();
 console.log(JSON.stringify({appearanceContrast:info.project.name,evidence}));
});
