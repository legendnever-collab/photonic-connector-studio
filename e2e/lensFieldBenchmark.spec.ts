import {test,expect} from '@playwright/test';
import type {Page,Locator} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {tab} from './ui';
const offline=pathToFileURL(resolve('dist/index.html')).href;
const root=(p:Page)=>p.getByRole('region',{name:'Lens Field Benchmark',exact:true});
async function save(page:Page){await tab(page,'Layout');const dl=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project JSON',exact:true}).click();return JSON.parse(await readFile((await(await dl).path())!,'utf8'));}
async function exported(page:Page,area:Locator){const dl=page.waitForEvent('download');await area.getByRole('button',{name:'Export Lens Benchmark JSON',exact:true}).click();return JSON.parse(await readFile((await(await dl).path())!,'utf8'));}
async function run(page:Page){await tab(page,'Analysis');await root(page).getByRole('button',{name:'Run Lens Field Benchmark',exact:true}).click();await expect(root(page).getByTestId('lens-benchmark-result')).toContainText('converged',{timeout:15000});}
test.beforeEach(async({page})=>{await page.context().setOffline(true);await page.goto(offline);});
test('independent screen benchmark stays separate from Mode and exports the same exact-input result in Report SVG',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const before=await save(page);await tab(page,'Analysis');const mode=await page.getByTestId('mode-overlap').textContent();await run(page);
 await expect(root(page).getByTestId('lens-benchmark-gate')).toContainText('exceeds-threshold');const json=await exported(page,root(page));expect(json.result.inputSignature).toBe(JSON.stringify(before,null,2));expect(json.result.metrics.history.length).toBeGreaterThanOrEqual(3);expect(json.result.physicalEtaErrorBound).toBeNull();expect(json.result.totalCoupling).toBeNull();expect(json.result.metrics.sample.referenceFidelity).toBeGreaterThan(.97);expect(await page.getByTestId('mode-overlap').textContent()).toBe(mode);
 await root(page).scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/D235-benchmark-${info.project.name}.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await save(page)).toEqual(before);
 await page.getByRole('button',{name:'Report View',exact:true}).click();const report=page.locator('.report-inline');expect(await exported(page,report)).toEqual(json);const dl=page.waitForEvent('download');await report.getByRole('button',{name:'SVG',exact:true}).click();const svg=await readFile((await(await dl).path())!,'utf8'),meta=await page.evaluate(text=>JSON.parse(new DOMParser().parseFromString(text,'image/svg+xml').querySelector('metadata')!.textContent!),svg);expect(meta.lensFieldBenchmark).toEqual(json);expect(meta.conditionalModeOverlap.status).toBe('valid');expect(errors).toEqual([]);
});
test('changed inputs suppress old metrics; Undo restores the exact result; a small-footprint benchmark passes only its screen gate',async({page})=>{
 const before=await save(page);await run(page);const original=await exported(page,root(page)),small=structuredClone(before);small.model.sourceMode.mfdX=small.model.sourceMode.mfdY=100e-6;small.model.targetMode.mfdX=small.model.targetMode.mfdY=100e-6;await tab(page,'Layout');await page.getByTestId('surface-json-input').setInputFiles({name:'small.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(small))});await tab(page,'Analysis');await expect(root(page).getByTestId('lens-benchmark-result')).toHaveAttribute('data-state','stale');expect((await exported(page,root(page))).result).toBeNull();await expect(root(page)).not.toContainText('Residual phase RMS');
 await tab(page,'Layout');await page.getByRole('button',{name:'Undo',exact:true}).click();await tab(page,'Analysis');expect(await exported(page,root(page))).toEqual(original);await tab(page,'Layout');await page.getByRole('button',{name:'Redo',exact:true}).click();await run(page);await expect(root(page).getByTestId('lens-benchmark-gate')).toContainText('within-threshold');expect((await exported(page,root(page))).result.physicalEtaErrorBound).toBeNull();await page.reload();await tab(page,'Analysis');await expect(root(page).getByTestId('lens-benchmark-result')).toHaveAttribute('data-state','not-calculated');
});
test('cancel and unsupported tilt never expose a field accuracy pass or write Project',async({page})=>{
 const before=await save(page);await tab(page,'Analysis');
 // Exercise an immediate user cancellation between refinement levels.
 await page.evaluate(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='Run Lens Field Benchmark')!;button.click();setTimeout(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Cancel Lens Benchmark')?.click(),0);});
 await expect(root(page).getByTestId('lens-benchmark-result')).toContainText('cancelled');expect((await exported(page,root(page))).result.metrics).toBeNull();expect(await save(page)).toEqual(before);
 const tilted=structuredClone(before);tilted.model.prescription.assemblies[0].frame.rotation.yaw=.001;await page.getByTestId('surface-json-input').setInputFiles({name:'tilted.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(tilted))});await tab(page,'Analysis');await root(page).getByRole('button',{name:'Run Lens Field Benchmark',exact:true}).click();await expect(root(page).getByTestId('lens-benchmark-result')).toContainText('tilt is unsupported');expect((await exported(page,root(page))).result.metrics).toBeNull();await expect(page.getByTestId('mode-overlap')).not.toHaveText('Not calculated');
});
