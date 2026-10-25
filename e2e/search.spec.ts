import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
const offline=pathToFileURL(resolve('dist/index.html')).href;
async function save(page:Page){const dl=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project JSON',exact:true}).click();return JSON.parse(await readFile((await(await dl).path())!,'utf8'));}
async function task(page:Page){await page.getByLabel('Project Example',{exact:true}).selectOption('routing:search');}
async function open(page:Page){await page.getByRole('button',{name:'Find Routing Solutions',exact:true}).click();}
async function run(page:Page){await page.getByRole('button',{name:'Run Search',exact:true}).click();await expect(page.getByTestId('search-status')).toBeVisible();}
test.beforeEach(async({page},info)=>{test.skip(info.project.name!=='desktop','PC-first S2 solution comparison.');await page.context().setOffline(true);await page.goto(offline);});
test('offline search previews multiple topologies while the canonical Project stays unchanged',async({page})=>{
 await task(page);const before=await save(page),hash=await page.getByTestId('shared-project-id').innerText();await open(page);await run(page);
 await expect(page.getByTestId('search-status')).toHaveText('Candidates ready');expect(await page.getByTestId('route-candidate').count()).toBeGreaterThan(1);
 await page.getByTestId('route-candidate').filter({hasText:'Mirror + TIR Prism'}).click();await expect(page.getByTestId('route-preview')).toContainText('Mirror + TIR Prism');await page.getByRole('button',{name:'Focus Candidate Folds',exact:true}).click();await expect(page.getByTestId('shared-project-id')).toHaveText(hash);
 await page.getByRole('button',{name:'Close Routing Search',exact:true}).click();expect(await save(page)).toEqual(before);
});
test('Apply is one Undo operation and preserves fixed Ports, Lens, Mode and mechanical Fiber data',async({page})=>{
 await task(page);const before=await save(page);await open(page);await run(page);await page.getByRole('button',{name:'Apply Candidate',exact:true}).click();await expect(page.getByTestId('routing-summary-status')).toHaveText('Within geometric tolerances');
 const after=await save(page);expect(after.model.prescription.source).toEqual(before.model.prescription.source);expect(after.model.prescription.surfaces.slice(0,2)).toEqual(before.model.prescription.surfaces.slice(0,2));expect(after.model.prescription.surfaces.at(-1)).toEqual(before.model.prescription.surfaces.at(-1));expect(after.model.sourceMode).toEqual(before.model.sourceMode);expect(after.model.targetMode).toEqual(before.model.targetMode);expect(after.authoring).toEqual(before.authoring);expect(after.sourceBody).toEqual(before.sourceBody);expect(after.targetBody).toEqual(before.targetBody);expect(after.routing.solution.engine).toBe('bounded-port-routing/1.0.0');
 await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await save(page)).toEqual(before);await page.getByRole('button',{name:'Redo',exact:true}).click();expect(await save(page)).toEqual(after);
});
test('applied candidates survive SaveLoad and Report export while unsupported Mode Coupling stays uncalculated',async({page})=>{
 await task(page);await open(page);await run(page);await page.getByRole('button',{name:'Apply Candidate',exact:true}).click();const p=await save(page);
 await page.getByTestId('surface-json-input').setInputFiles({name:'s2-route.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});expect(await save(page)).toEqual(p);
 await page.getByRole('button',{name:'Report View',exact:true}).click();await expect(page.getByTestId('report-figure')).toBeVisible();const dl=page.waitForEvent('download');await page.locator('.report-inline').getByRole('button',{name:'SVG',exact:true}).click();const svg=await readFile((await(await dl).path())!,'utf8');expect(svg).toContain('bounded-port-routing/1.0.0');expect(svg).toContain('S2-mirror');
 await page.getByRole('button',{name:'Gaussian View',exact:true}).click();await expect(page.getByTestId('physical-gaussian-status')).toHaveText('Aperture-limited reference');await page.getByRole('button',{name:'Analysis',exact:true}).click();await expect(page.getByTestId('mode-overlap')).toHaveText('Not calculated');expect(await save(page)).toEqual(p);
});
test('changed settings invalidate old candidates and budget exhaustion is distinct from no candidate found',async({page})=>{
 await task(page);await open(page);await run(page);await page.getByText('Search Settings',{exact:true}).click();await page.getByLabel('Search Budget',{exact:true}).fill('1');await expect(page.getByTestId('search-stale')).toBeVisible();await expect(page.getByRole('button',{name:'Apply Candidate',exact:true})).toBeDisabled();
 await run(page);await expect(page.getByTestId('search-status')).toHaveText('Budget exhausted');await expect(page.getByTestId('search-result')).toContainText('only the evaluated');
 await page.getByText('Search Settings',{exact:true}).click();await page.getByLabel('Search Budget',{exact:true}).fill('128');for(const name of ['1 Mirror','2 Mirrors','TIR Prism','Mirror + TIR Prism'])await page.getByLabel(`Search ${name}`,{exact:true}).uncheck();await run(page);await expect(page.getByTestId('search-status')).toHaveText('No candidate found');await expect(page.getByTestId('search-result')).toContainText('not proof');
});
test('part restrictions and undefined Output medium have explicit failure states without applying a layout',async({page})=>{
 await task(page);await page.getByText('Design Space / Part Limits',{exact:true}).click();await page.getByLabel('Max mirror',{exact:true}).fill('0');await page.getByLabel('Max prism',{exact:true}).fill('0');const before=await save(page);await open(page);await run(page);await expect(page.getByTestId('search-status')).toHaveText('No candidate found');await expect(page.getByRole('button',{name:'Apply Candidate',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Close Routing Search',exact:true}).click();expect(await save(page)).toEqual(before);
 await page.getByRole('button',{name:'New Physical Project',exact:true}).click();await page.getByRole('button',{name:'Design Setup',exact:true}).click();await open(page);await run(page);await expect(page.getByTestId('search-status')).toHaveText('Unsupported setup');await expect(page.getByTestId('search-result')).toContainText('Output reference');
});
test('closing an active search cancels the session and leaves the Project unchanged',async({page})=>{
 await task(page);const before=await save(page);await open(page);await page.getByRole('button',{name:'Run Search',exact:true}).click();await page.keyboard.press('Escape');await expect(page.getByTestId('route-search-dialog')).toHaveCount(0);expect(await save(page)).toEqual(before);
});
test('desktop comparison windows keep the Preview and Apply action within laptop viewports',async({page})=>{
 await task(page);await open(page);await run(page);for(const [width,height]of [[1366,768],[1440,1000]]){
  await page.setViewportSize({width,height});const box=await page.getByTestId('route-search-dialog').boundingBox();expect(box!.width).toBeGreaterThan(1000);expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(height+1);await expect(page.getByRole('button',{name:'Apply Candidate',exact:true})).toBeInViewport();await expect(page.getByTestId('route-preview')).toBeVisible();await page.screenshot({path:`test-results/S2-candidates-${width}.png`,fullPage:true});
 }
});
