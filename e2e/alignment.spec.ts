import { tab as unifiedTab } from './ui';
import { expect,test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {resolve} from "node:path";
const tab=unifiedTab;
async function example(page:Page,id:string){await page.getByLabel('Project Example',{exact:true}).selectOption('ideal:'+id);}
async function choose(page:Page,id:string){await tab(page,'Train');await page.getByTestId(`tree-${id}`).click();}
async function save(page:Page){await tab(page,'Layout');const d=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project JSON',exact:true}).click();return JSON.parse(await readFile((await(await d).path())!,'utf8'));}
async function expand(page:Page){await tab(page,'Analysis');await page.getByRole('button',{name:'Expand Alignment Analysis',exact:true}).click();await expect(page.getByRole('dialog',{name:'Alignment Analysis',exact:true})).toBeVisible();}
test.beforeEach(async({page})=>{await page.goto('/');});
test('Source Tilt propagates beam axis and preserves focus/SVG/camera under repeated edits',async({page})=>{
 await example(page,'pointing');await expect(page.getByTestId('beam-axis')).toBeVisible();await page.getByRole('button',{name:'Zoom in',exact:true}).click();
 await page.evaluate(()=>{const w=window as unknown as Record<string,unknown>;w.axis=document.querySelector('[data-testid="beam-axis"]');w.points=document.querySelector('[data-testid="beam-axis"]')?.getAttribute('points');w.svg=document.querySelector('[data-testid="optical-canvas"]');});
 await tab(page,'Analysis');await expect(page.getByTestId('axis-metrics')).toContainText('4 / 0 µm');await expect(page.getByTestId('axis-metrics')).toContainText('-3 / 0 mrad');
 await choose(page,'fiber');const input=page.getByLabel('Yaw',{exact:true});for(const v of ['0.1','0.15','0.2']){await input.fill(v);await expect(input).toBeFocused();}
 await page.getByRole('button',{name:'편집 종료 · Layout',exact:true}).click();expect(await page.evaluate(()=>{const w=window as unknown as Record<string,unknown>;return w.axis===document.querySelector('[data-testid="beam-axis"]')&&w.svg===document.querySelector('[data-testid="optical-canvas"]')&&w.points!==document.querySelector('[data-testid="beam-axis"]')?.getAttribute('points');})).toBe(true);
 await expect(page.getByTestId('zoom-level')).toHaveText('125%');
});
test('WG Tilt benchmark and angle-domain gates suppress stale axis/sensitivity',async({page})=>{
 await example(page,'tilt');await expect(page.getByTestId('summary-eta')).toHaveText('36.7879%');await choose(page,'waveguide');await page.getByLabel('Yaw',{exact:true}).fill('3');await tab(page,'Analysis');await expect(page.getByTestId('solver-status')).toHaveText('out-of-domain');await expect(page.getByTestId('scan-invalid')).toContainText('50 mrad');await expect(page.getByTestId('map-cell-220')).toHaveCount(0);
 await choose(page,'waveguide');await page.getByLabel('Yaw',{exact:true}).fill('0');await tab(page,'Analysis');await expect(page.getByTestId('eta')).toHaveText('100%');
});
test('expanded sensitivity controls update curves/ranges and CSV without mutating Design',async({page})=>{
 await example(page,'matching');const before=await save(page);await expand(page);await expect(page.getByTestId('offset-acceptance')).toContainText('8.4279');await expect(page.getByTestId('tilt-acceptance')).toContainText('8.4279');
 const path=await page.getByTestId('offset-curve-path').getAttribute('d');await page.getByLabel('Sensitivity Axis',{exact:true}).selectOption('z');await page.getByLabel('Coupling Threshold',{exact:true}).fill('50');await expect(page.getByTestId('offset-acceptance')).toContainText('14.854');
 await page.getByLabel('Offset Scan Span',{exact:true}).fill('1');await expect(page.getByTestId('offset-acceptance')).toContainText('Scan 끝까지 통과');expect(await page.getByTestId('offset-curve-path').getAttribute('d')).not.toBe(path);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export Sweep CSV',exact:true}).click();const csv=await readFile((await(await download).path())!,'utf8');expect(csv).toContain('delta_port_rotation_rad');expect(csv.split('\n')).toHaveLength(565);expect(csv).toContain('"z"');
 await page.getByRole('button',{name:'Close Alignment Analysis',exact:true}).click();expect(await save(page)).toEqual(before);
});
test('map cell inspection, invalid scan drafts and domain edges remain explicit',async({page})=>{
 await example(page,'matching');await expand(page);await page.getByTestId('map-cell-220').click();await expect(page.getByTestId('map-inspection')).toContainText('η 100%');
 const span=page.getByLabel('Offset Scan Span',{exact:true});await span.fill('0');await expect(span).toBeFocused();await expect(page.getByTestId('scan-invalid')).toBeVisible();await expect(page.getByTestId('offset-curve-path')).toHaveCount(0);
 await span.fill('30');await page.getByLabel('Tilt Scan Span',{exact:true}).fill('100');await expect(page.getByTestId('map-cell-0')).toHaveAttribute('fill','#c2cbd2');await page.getByTestId('map-cell-0').click();await expect(page.getByTestId('map-inspection')).toContainText('50 mrad');
 await page.getByRole('button',{name:'Close Alignment Analysis',exact:true}).press('Escape');await expect(page.getByRole('dialog',{name:'Alignment Analysis',exact:true})).toHaveCount(0);
});
test('Tilt and sensitivity recompute after Save/Load and Undo/Redo',async({page})=>{
 await example(page,'pointing');const data=await save(page),eta=await page.getByTestId('summary-eta').textContent();await page.getByLabel('Project Example',{exact:true}).selectOption('ideal:matching');await expect(page.getByTestId('summary-eta')).toHaveText('100%');await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByTestId('summary-eta')).toHaveText(eta!);await page.getByRole('button',{name:'Redo',exact:true}).click();await expect(page.getByTestId('summary-eta')).toHaveText('100%');
 await page.getByTestId('surface-json-input').setInputFiles({name:'axis.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await expect(page.getByTestId('summary-eta')).toHaveText(eta!);await tab(page,'Analysis');await expect(page.getByTestId('scan-provenance')).toContainText(eta!);
});
test('offline alignment/CSV work and expanded layouts fit mobile/tablet/desktop',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.context().setOffline(true);await page.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());await page.goto(pathToFileURL(resolve('dist/index.html')).href);await example(page,'pointing');await expand(page);
 await page.getByLabel('Sensitivity Axis',{exact:true}).selectOption('z');await page.getByTestId('map-cell-220').click();await expect(page.getByTestId('map-inspection')).toContainText('η');
 const d=page.waitForEvent('download');await page.getByRole('button',{name:'Export Sweep CSV',exact:true}).click();expect((await readFile((await(await d).path())!,'utf8')).length).toBeGreaterThan(1000);
 const widths=info.project.name==='desktop'?[360,412,768,1366]:[412];
 for(const width of widths){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const b=await page.getByRole('dialog',{name:'Alignment Analysis',exact:true}).boundingBox();expect(b!.x).toBeGreaterThanOrEqual(0);expect(b!.x+b!.width).toBeLessThanOrEqual(width);await page.screenshot({path:`test-results/P1.2-alignment-${info.project.name}-${width}.png`,fullPage:true});}
 expect(errors).toEqual([]);
});
