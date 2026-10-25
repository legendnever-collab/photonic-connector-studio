import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
const offline=pathToFileURL(resolve('dist/index.html')).href;
async function save(page:Page){const d=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project JSON',exact:true}).click();return JSON.parse(await readFile((await(await d).path())!,'utf8'));}
async function report(page:Page){await page.getByRole('button',{name:'Report View',exact:true}).click();await expect(page.getByTestId('report-details')).toBeVisible();}
test.beforeEach(async({page},info)=>{test.skip(info.project.name!=='desktop','Report composition is PC-first.');await page.context().setOffline(true);await page.goto(offline);});
test('linked 3D region uses real Lens shape, dimensions and Gaussian data, without Project writes',async({page})=>{
 const before=await save(page);await report(page);const figure=page.getByTestId('report-figure'),fp=await figure.getAttribute('data-fingerprint');
 await expect(page.getByTestId('report-detail-viewport')).toHaveCount(1);await expect(page.getByTestId('report-region-box')).toBeVisible();await expect(page.getByTestId('report-detail-link')).toBeVisible();await expect(page.getByTestId('report-detail-dimensions')).toContainText('t = 1.000 mm');await expect(page.getByTestId('report-detail-beam')).toContainText('815.9');expect(await page.getByTestId('report-physical-beam').count()).toBeGreaterThan(100);
 await page.getByRole('button',{name:'Top oblique',exact:true}).click();await expect(figure).toHaveAttribute('data-fingerprint',fp!);expect(await save(page)).toEqual(before);
 await page.getByRole('button',{name:'Surface View',exact:true}).click();await expect(page.getByLabel('S1 Thickness',{exact:true})).toBeVisible();await page.getByLabel('S1 Thickness',{exact:true}).fill('0.8');await report(page);await expect(page.getByTestId('report-detail-dimensions')).toContainText('t = 0.8000 mm');await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByTestId('report-detail-dimensions')).toContainText('t = 1.000 mm');expect(await save(page)).toEqual(before);
});
test('folded Prism detail includes real depth, reflected ray directions and aperture-limited Beam scope',async({page})=>{
 await page.getByLabel('Project Example',{exact:true}).selectOption('routing:prism');await report(page);await expect(page.getByTestId('report-details')).toContainText('Prism depth');await expect(page.getByTestId('report-details')).toContainText('P-TIR');expect(await page.getByTestId('report-direction').count()).toBeGreaterThan(3);
 const before=await save(page),dl=page.waitForEvent('download');await page.locator('.report-inline').getByRole('button',{name:'SVG',exact:true}).click();const svg=await readFile((await(await dl).path())!,'utf8');expect(svg).toContain('untruncated Gaussian reference');expect(svg).toContain('report-detail-viewport');expect(svg).toContain('href="#report-optical-scene-');expect(svg).not.toMatch(/<image[^>]+https?:|<script/);expect(await save(page)).toEqual(before);await page.getByRole('button',{name:'Expand Report',exact:true}).click();await expect(page.getByRole('dialog').getByTestId('report-detail-viewport')).toHaveCount(2);await page.screenshot({path:'test-results/Report-Prism-3D-details.png',fullPage:true});
});
test('expanded Report and offline PNG retain complete insets and close back to editing',async({page})=>{
 await report(page);await page.getByRole('button',{name:'Expand Report',exact:true}).click();const modal=page.getByRole('dialog');await expect(modal.getByTestId('report-details')).toBeVisible();await expect(modal.getByTestId('report-dimension-line')).toHaveCount(2);
 const dl=page.waitForEvent('download');await modal.getByRole('button',{name:'PNG 2×',exact:true}).click();const png=await readFile((await(await dl).path())!);expect(png.readUInt32BE(16)).toBe(3200);expect(png.readUInt32BE(20)).toBe(2000);expect(png.length).toBeGreaterThan(100000);
 await page.screenshot({path:'test-results/Report-3D-details.png',fullPage:true});await modal.getByRole('button',{name:'Close Report Figure',exact:true}).click();await expect(page.getByRole('button',{name:'Expand Report',exact:true})).toBeFocused();await page.getByRole('button',{name:'Surface View',exact:true}).click();await expect(page.getByLabel('S1 Thickness',{exact:true})).toBeVisible();
});
test('laptop viewports keep Report exports visible; undefined Mode suppresses Gaussian annotations',async({page})=>{
 await report(page);for(const [width,height] of [[1366,768],[1440,1000]]){await page.setViewportSize({width,height});await expect(page.getByRole('button',{name:'Expand Report',exact:true})).toBeInViewport();await expect(page.locator('.report-inline').getByRole('button',{name:'PNG 2×',exact:true})).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 const p=await save(page);p.model.sourceMode.mfdX=null;await page.getByTestId('surface-json-input').setInputFiles({name:'undefined.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});await expect(page.getByTestId('report-detail-beam')).toContainText('Not calculated');await expect(page.getByTestId('report-physical-beam')).toHaveCount(0);
});
test('all separated regions are available on paged sheets and modal SVG references stay independent',async({page})=>{
 const p=await save(page),d=p.model.prescription,a=d.assemblies.find((a:{kind:string})=>a.kind==='lens'),ss=d.surfaces.filter((s:{assemblyId:string})=>s.assemblyId===a.id),body=p.bodies.find((b:{assemblyId:string})=>b.assemblyId===a.id);
 for(const [i,x]of [[1,.001],[2,.008]]){const id='extra'+i,copy=structuredClone(a);copy.id=id;copy.frame.origin.x=x;d.assemblies.push(copy);d.surfaces.splice(d.surfaces.length-1,0,...ss.map((s:{id:string})=>({...structuredClone(s),id:s.id+id,assemblyId:id})));p.bodies.push({...structuredClone(body),assemblyId:id});}
 await page.getByTestId('surface-json-input').setInputFiles({name:'regions.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});await report(page);await expect(page.getByTestId('report-detail-viewport')).toHaveCount(2);await expect(page.getByRole('button',{name:'Next detail page',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Next detail page',exact:true}).click();await expect(page.getByTestId('report-detail-viewport')).toHaveCount(1);
 const before=await page.getByTestId('report-detail-viewport').locator('use').getAttribute('href');await page.getByRole('button',{name:'Expand Report',exact:true}).click();const modal=page.getByRole('dialog');expect(await modal.getByTestId('report-detail-viewport').first().locator('use').getAttribute('href')).not.toEqual(before);await modal.getByRole('button',{name:'Top oblique',exact:true}).click();await modal.getByRole('button',{name:'Close Report Figure',exact:true}).click();expect(await page.getByTestId('report-detail-viewport').locator('use').getAttribute('href')).toEqual(before);
});

test('high magnification Prism stays visible under thin rays and bounded arrowheads in the exported Report',async({page})=>{
 await page.getByLabel('Project Example',{exact:true}).selectOption('routing:prism');const p=await save(page),lens=p.bodies.find((b:{kind:string})=>b.kind==='lens');lens.outerRadius=.0012;
 p.model.prescription.surfaces.filter((s:{assemblyId:string})=>s.assemblyId===lens.assemblyId).forEach((s:{aperture:number})=>s.aperture=.001);
 await page.getByTestId('surface-json-input').setInputFiles({name:'prism-magnification.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});await report(page);const before=await save(page);
 await page.getByRole('button',{name:'Expand Report',exact:true}).click();const modal=page.getByRole('dialog'),inset=modal.locator('[data-detail-inset]').filter({hasText:'BK7 TIR Prism'}),view=inset.getByTestId('report-detail-viewport');
 expect(Number(await view.getAttribute('data-zoom'))).toBeGreaterThan(10);
 const sizes=await view.getByTestId('report-direction-head').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return Math.hypot(r.width,r.height);}));expect(sizes.length).toBeGreaterThan(0);expect(Math.max(...sizes)).toBeLessThan(9);
 await expect(modal.getByTestId('report-figure').locator('[data-defined-body="Fold-Prism"]').first()).toBeVisible();
 const dl=page.waitForEvent('download');await modal.getByRole('button',{name:'SVG',exact:true}).click();const svg=await readFile((await(await dl).path())!,'utf8');expect(svg).toContain('non-scaling-stroke');expect(svg).not.toMatch(/marker-end=|<marker\b/);expect(svg).toContain('report-figure/2.4.2');
 await page.screenshot({path:'test-results/Report-Prism-high-magnification-fixed.png',fullPage:true});await modal.getByRole('button',{name:'Close Report Figure',exact:true}).click();expect(await save(page)).toEqual(before);
});
