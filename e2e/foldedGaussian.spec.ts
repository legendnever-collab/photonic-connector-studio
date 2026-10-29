import {openTechnicalExamples} from './ui';
import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
const offline=pathToFileURL(resolve('dist/index.html')).href+'#starter';
async function save(page:Page){const dl=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project JSON',exact:true}).click();return JSON.parse(await readFile((await(await dl).path())!,'utf8'));}
async function load(page:Page,p:unknown,discard=false){await page.getByTestId('surface-json-input').setInputFiles({name:'folded.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});const guard=page.getByRole('dialog',{name:'Unsaved Project',exact:true});if(discard){await expect(guard).toBeVisible();await guard.getByRole('button',{name:'Discard & Open',exact:true}).click();}}
async function setup(page:Page){await openTechnicalExamples(page);await page.getByLabel('Project Example',{exact:true}).selectOption('routing:mirrors');await page.getByRole('button',{name:'Gaussian View',exact:true}).click();}
test.beforeEach(async({page},info)=>{test.skip(info.project.name!=='desktop','S3.1 PC beam analysis workflows.');await page.context().setOffline(true);await page.goto(offline);});
test('offline folded envelopes, Output section, Surface data and export are read-only views of the same Project',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);const before=await save(page);
 await expect(page.getByTestId('physical-gaussian-status')).toHaveText('Aperture-limited reference');await expect(page.getByTestId('folded-beam-envelope')).toBeVisible();await expect(page.getByTestId('folded-beam-scope')).toContainText('untruncated');
 await page.getByLabel('Inspect Beam Surface',{exact:true}).selectOption('M1');const first=await page.getByTestId('physical-beam-diameter').textContent();await page.getByLabel('Inspect Beam Surface',{exact:true}).selectOption('M2');await expect(page.getByTestId('physical-beam-diameter')).not.toHaveText(first!);
 await page.getByRole('button',{name:'Spatial Envelope',exact:true}).click();await expect(page.getByTestId('folded-spatial-envelope')).toBeVisible();await page.getByLabel('Beam Spatial Projection',{exact:true}).selectOption('YZ');
 await page.getByRole('button',{name:'Output Section',exact:true}).click();await expect(page.getByTestId('folded-output-section')).toBeVisible();await page.getByRole('button',{name:'Surface Beam Data',exact:true}).click();await expect(page.getByTestId('folded-beam-table')).toContainText('M1 · before');
 const dl=page.waitForEvent('download');await page.getByRole('button',{name:'Export Beam Analysis',exact:true}).click();const data=JSON.parse(await readFile((await(await dl).path())!,'utf8'));expect(data.id).toBe('transported-scalar-gaussian/1.1.0');expect(data.units).toBe('SI');expect(data.apertureLimited).toBe(true);expect(data.surfaces).toHaveLength(5);
 await page.getByRole('button',{name:'Analysis',exact:true}).click();await expect(page.getByTestId('folded-mode-details')).toBeVisible();await expect(page.getByTestId('mode-overlap')).toHaveText('Not calculated');expect(await save(page)).toEqual(before);expect(errors).toEqual([]);
});
test('MFD edit, Undo, SaveLoad and geometry failure recalculate or remove the envelope',async({page})=>{
 await setup(page);const first=await page.getByTestId('physical-beam-diameter').textContent();await page.getByRole('navigation',{name:'Representation'}).getByRole('button',{name:'Input Mode',exact:true}).click();await page.getByLabel('Input MFD X',{exact:true}).fill('12');await expect(page.getByTestId('physical-beam-diameter')).not.toHaveText(first!);const changed=await save(page),value=await page.getByTestId('physical-beam-diameter').textContent();await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByTestId('physical-beam-diameter')).toHaveText(first!);await load(page,changed,true);await expect(page.getByTestId('physical-beam-diameter')).toHaveText(value!);
 const invalid=structuredClone(changed);invalid.model.prescription.source.n=1.1;await load(page,invalid);await expect(page.getByTestId('physical-gaussian-reason')).toContainText('medium mismatch');await expect(page.getByTestId('folded-beam-envelope')).toHaveCount(0);await expect(page.getByTestId('physical-beam-diameter')).toHaveCount(0);
});
test('TIR Prism shows arclength, body warnings and explicit undefined PIC coupling',async({page})=>{
 await openTechnicalExamples(page);await page.getByLabel('Project Example',{exact:true}).selectOption('routing:prism');await page.getByRole('button',{name:'Gaussian View',exact:true}).click();await expect(page.getByTestId('folded-beam-envelope')).toBeVisible();await page.getByRole('button',{name:'Surface Beam Data',exact:true}).click();await expect(page.getByTestId('folded-beam-table')).toContainText('P-TIR');await page.getByRole('button',{name:'Analysis',exact:true}).click();await expect(page.getByTestId('folded-mode-details')).toContainText('PIC receiving field is undefined');
 const p=await save(page);p.model.prescription.surfaces.find((s:{id:string})=>s.id==='P-TIR').outsideIndex=1.49;await load(page,p);await expect(page.getByTestId('physical-gaussian-reason')).toContainText('TIR condition not met');
});
test('laptop windows keep beam and metrics visible across view controls',async({page})=>{
 await setup(page);const p=await save(page);for(const [width,height]of [[1366,768],[1440,1000]]){await page.setViewportSize({width,height});await expect(page.getByTestId('folded-beam-envelope')).toBeInViewport();await expect(page.getByTestId('physical-beam-diameter')).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/S3-folded-beam-${width}.png`,fullPage:true});}
 await page.getByRole('button',{name:'Surface View',exact:true}).click();await expect(page.getByTestId('surface-canvas')).toBeVisible();await page.getByRole('button',{name:'Gaussian View',exact:true}).click();await expect(page.getByTestId('folded-beam-envelope')).toBeVisible();expect(await save(page)).toEqual(p);
});
