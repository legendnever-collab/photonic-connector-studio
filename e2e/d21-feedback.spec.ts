import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {defaultProblem} from '../src/design/engine';
const offline=pathToFileURL(resolve('dist/index.html')).href;
async function layout(page:Page){const button=page.getByRole('navigation',{name:'Surface Workspace tabs'}).getByRole('button',{name:'Layout',exact:true});if(await button.isVisible())await button.click();}
async function save(page:Page){await layout(page);const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project JSON',exact:true}).click();return JSON.parse(await readFile((await(await pending).path())!,'utf8'));}
test('reported Mirror/Prism path exposes both physical folds and repairs inherited limits explicitly',async({page})=>{
 test.setTimeout(180000);await page.context().setOffline(true);await page.goto(offline);
 await page.getByRole('button',{name:'Design Setup',exact:true}).click();await page.getByLabel('Output Global Z',{exact:true}).fill('5000');await page.getByLabel('Output Global Z',{exact:true}).blur();
 await page.getByRole('button',{name:'Find Routing Solutions',exact:true}).click();
 for(const name of ['Direct','1 Mirror','2 Mirrors','TIR Prism'])await page.getByLabel(`Search ${name}`,{exact:true}).uncheck();
 await page.getByRole('button',{name:'Run Search',exact:true}).click();await expect(page.getByTestId('route-candidate').first()).toBeVisible();
 await expect(page.getByTestId('route-optical-scope')).toContainText('Mode matching 미검증');
 await page.getByRole('button',{name:'Apply Candidate',exact:true}).click();await layout(page);await page.getByRole('button',{name:'Report View',exact:true}).click();
 await expect(page.getByTestId('report-fold-marker')).toHaveCount(2);await expect(page.getByTestId('report-fold-marker').first()).toContainText('Mirror');await expect(page.getByTestId('report-fold-marker').nth(1)).toContainText('TIR Prism');await expect(page.getByTestId('report-route-scope')).toContainText('3 / 13');
 await expect(page.getByTestId('report-details')).toContainText('Auto Mirror');
 await page.screenshot({path:`test-results/D211-folds-${test.info().project.name}.png`,fullPage:true});
 const baseline=await save(page);baseline.designProblem=defaultProblem(baseline);expect(baseline.designProblem.maxGenerated).toBe(2);
 await page.getByTestId('surface-json-input').setInputFiles({name:'reported-limits.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(baseline))});
 await page.getByRole('button',{name:'Design Setup',exact:true}).click();await page.getByRole('button',{name:'Setup Automatic Synthesis',exact:true}).click();
 await expect(page.getByTestId('synthesis-limit-summary')).toContainText('new·replacement 2');
 await page.getByRole('button',{name:'Run Automatic Synthesis',exact:true}).click();await expect(page.getByTestId('synthesis-result')).toContainText('0 candidates',{timeout:120000});
 await expect(page.getByTestId('synthesis-result')).toContainText('4 > 2');
 await page.getByRole('button',{name:'Allow 2 Lens + 2 Mirror search',exact:true}).click();
 await expect(page.getByLabel('Synthesis Max new parts',{exact:true})).toHaveValue('4');
 await page.getByRole('button',{name:'Run Automatic Synthesis',exact:true}).click();await expect(page.getByTestId('synthesis-metrics')).toContainText('Nominal Mode goals met',{timeout:120000});
 await page.screenshot({path:`test-results/D211-candidates-${test.info().project.name}.png`,fullPage:true});
 await page.getByRole('button',{name:'Apply Synthesis Candidate',exact:true}).click();const after=await save(page);expect(after.synthesis.solution.qualified).toBe(true);expect(after.model.prescription.surfaces).toHaveLength(7);
 await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await save(page)).toEqual(baseline);
});
