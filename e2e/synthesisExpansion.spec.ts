import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {tab,openProjectExample} from './ui';
const offline=pathToFileURL(resolve('dist/index.html')).href;
async function save(page:Page){await tab(page,'Layout');const dl=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project JSON',exact:true}).click();return JSON.parse(await readFile((await(await dl).path())!,'utf8'));}
async function open(page:Page){await tab(page,'Layout');await page.getByRole('button',{name:'Automatic Synthesis',exact:true}).click();await expect(page.getByRole('dialog',{name:'Automatic Synthesis',exact:true})).toBeVisible();}
test.beforeEach(async({page})=>{await page.context().setOffline(true);await page.goto(offline);});
test('blank two-Prism task generates, previews and applies common Mode results with one Undo',async({page},info)=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await openProjectExample(page,'routing:prism-synthesis');const before=await save(page);expect(before.model.prescription.surfaces).toHaveLength(1);
 await open(page);await expect(page.getByLabel('Synthesis family prism2',{exact:true})).toBeChecked();
 await page.getByRole('button',{name:'Run Automatic Synthesis',exact:true}).click();await expect(page.getByTestId('synthesis-result')).toBeVisible({timeout:60000});
 await expect(page.getByTestId('synthesis-metrics')).toContainText('Nominal Mode goals met');await expect(page.getByTestId('synthesis-metrics')).toContainText('Mode Overlap');
 await page.getByRole('button',{name:'Close',exact:true}).click();expect(await save(page)).toEqual(before);
 await open(page);await page.getByRole('button',{name:'Run Automatic Synthesis',exact:true}).click();await expect(page.getByTestId('synthesis-metrics')).toContainText('Nominal Mode goals met',{timeout:60000});
 await page.screenshot({path:`test-results/D222-candidates-${info.project.name}.png`,fullPage:true});await page.getByRole('button',{name:'Apply Synthesis Candidate',exact:true}).click();
 const after=await save(page);expect(after.model.prescription.surfaces.filter((s:{interaction:string})=>s.interaction==='tir')).toHaveLength(2);expect(after.synthesis.solution.qualified).toBe(true);expect(after.model.sourceMode).toEqual(before.model.sourceMode);expect(after.model.targetMode).toEqual(before.model.targetMode);
 await tab(page,'Analysis');const eta=await page.getByTestId('mode-overlap').textContent();expect(eta).not.toBe('Not calculated');
 await tab(page,'Layout');await page.getByRole('button',{name:'Gaussian View',exact:true}).click();await expect(page.getByTestId('physical-overlap')).toContainText(eta!);await page.getByRole('button',{name:'Report View',exact:true}).click();await expect(page.getByTestId('report-mode-overlap')).toContainText(eta!);
 await page.screenshot({path:`test-results/D222-report-${info.project.name}.png`,fullPage:true});await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await save(page)).toEqual(before);await page.getByRole('button',{name:'Redo',exact:true}).click();expect(await save(page)).toEqual(after);expect(errors).toEqual([]);
});
test('new bounded manufacturing and air-allocation settings save and roundtrip offline',async({page})=>{
 await openProjectExample(page,'routing:prism-synthesis');await open(page);await page.getByLabel('Synthesis Interior Lens segments',{exact:true}).check();await page.getByLabel('Synthesis Prism leg Max',{exact:true}).fill('8');await page.getByLabel('Synthesis Prism leg Max',{exact:true}).blur();
 await page.getByRole('button',{name:'Save Synthesis Settings',exact:true}).click();await page.getByRole('button',{name:'Close',exact:true}).click();const saved=await save(page);expect(saved.synthesis.lensPlacement).toBe('all-air');expect(saved.synthesis.prismLeg).toEqual([.006,.008]);
 await open(page);await expect(page.getByLabel('Synthesis Interior Lens segments',{exact:true})).toBeChecked();await expect(page.getByLabel('Synthesis Prism leg Max',{exact:true})).toHaveValue('8');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
