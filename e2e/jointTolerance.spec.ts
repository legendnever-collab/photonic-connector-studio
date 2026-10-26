import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {tab} from './ui';
const offline=pathToFileURL(resolve('dist/index.html')).href;
async function save(page:Page){await tab(page,'Layout');const dl=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project JSON',exact:true}).click();return JSON.parse(await readFile((await(await dl).path())!,'utf8'));}
async function open(page:Page){await tab(page,'Layout');await page.getByRole('button',{name:'Design Problem',exact:true}).click();await page.getByRole('button',{name:'Joint Tolerance',exact:true}).click();}
async function run(page:Page){await page.getByRole('button',{name:'Assess Joint Tolerance',exact:true}).click();await expect(page.getByTestId('joint-result')).toBeVisible({timeout:20000});}
test.beforeEach(async({page})=>{await page.context().setOffline(true);await page.goto(offline);});
test('joint settings roundtrip with one Undo; read-only assessment, stale coverage and partial Lens domain are explicit',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const before=await save(page);await open(page);
 await expect(page.getByLabel('Joint mating target',{exact:true})).toBeChecked();await page.getByLabel('Joint Samples',{exact:true}).fill('8');await page.getByLabel('Joint Case cap',{exact:true}).fill('8');
 await run(page);await expect(page.getByTestId('joint-result')).toContainText('assessed');await expect(page.getByTestId('joint-result')).toContainText('8 / 8');
 await page.getByLabel('Joint assembly position Y',{exact:true}).fill('1');await expect(page.getByTestId('joint-result')).toContainText('Stale joint result');await run(page);
 await expect(page.getByTestId('joint-result')).toContainText('partial');await expect(page.getByTestId('joint-result')).toContainText('0 / 8');await expect(page.getByTestId('joint-result')).toContainText('centered');
 await page.getByTestId('joint-result').scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/D231-joint-${info.project.name}.png`,fullPage:true});
 await page.getByRole('button',{name:'Close Design Problem',exact:true}).click();expect(await save(page)).toEqual(before);
 await open(page);await page.getByLabel('Joint Seed',{exact:true}).fill('42');await page.getByLabel('Joint mating component Starter-Lens',{exact:true}).check();await page.getByRole('button',{name:'Save Problem Settings',exact:true}).click();await page.getByRole('button',{name:'Close Design Problem',exact:true}).click();
 const after=await save(page);expect(after.designProblem.jointTolerance.seed).toBe(42);expect(after.designProblem.jointTolerance.mating.components).toEqual(['Starter-Lens']);expect(after.model).toEqual(before.model);
 await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await save(page)).toEqual(before);await page.getByRole('button',{name:'Redo',exact:true}).click();expect(await save(page)).toEqual(after);
 await page.getByTestId('surface-json-input').setInputFiles({name:'joint.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(after))});const confirm=page.getByRole('dialog',{name:'Unsaved Project',exact:true});if(await confirm.isVisible())await confirm.getByRole('button',{name:'Discard & Open',exact:true}).click();
 await open(page);await expect(page.getByLabel('Joint Seed',{exact:true})).toHaveValue('42');await expect(page.getByLabel('Joint mating component Starter-Lens',{exact:true})).toBeChecked();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('case cap and cancellation never present complete joint goals; Escape preserves Project',async({page})=>{
 const before=await save(page);await open(page);await page.getByLabel('Joint Case cap',{exact:true}).fill('1');await run(page);await expect(page.getByTestId('joint-result')).toContainText('partial');await expect(page.getByTestId('joint-result')).toContainText('1 / 32');
 await page.getByLabel('Joint Samples',{exact:true}).fill('256');await page.getByLabel('Joint Case cap',{exact:true}).fill('256');await page.getByRole('button',{name:'Assess Joint Tolerance',exact:true}).click();await page.getByRole('button',{name:'Cancel Problem Search',exact:true}).click();await expect(page.getByTestId('joint-result')).toContainText('cancelled');
 await page.getByRole('button',{name:'Assess Joint Tolerance',exact:true}).click();await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Design Problem',exact:true})).toHaveCount(0);expect(await save(page)).toEqual(before);
});
