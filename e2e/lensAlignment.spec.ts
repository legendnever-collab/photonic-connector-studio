import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
async function save(page:Page){const mobile=page.getByRole('navigation',{name:'Surface Workspace tabs'});if(await mobile.isVisible())await mobile.getByRole('button',{name:'Layout',exact:true}).click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project JSON',exact:true}).click();return JSON.parse(await readFile((await(await pending).path())!,'utf8'));}
test('50 µm Output offset → bounded Lens compensation → preview → Apply / Undo',async({page},info)=>{
 test.setTimeout(120000);await page.context().setOffline(true);await page.goto(pathToFileURL(resolve('dist/index.html')).href);await page.getByRole('button',{name:'1번 예시 열기',exact:true}).click();
 await page.getByLabel('Output Global Z',{exact:true}).fill('50');await page.getByLabel('Output Global Z',{exact:true}).blur();await page.getByRole('navigation',{name:'설계 순서'}).getByRole('button',{name:'③ 광학계 설계',exact:true}).click();const before=await save(page);
 await page.getByRole('button',{name:'자동 설계 찾기',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Automatic Synthesis',exact:true});await expect(dialog.getByLabel('Synthesis Lens alignment',{exact:true})).toBeChecked();
 for(const family of ['mirror1','mirror2','prism1','mirror-prism'])await dialog.getByLabel('Synthesis family '+family,{exact:true}).uncheck();
 await dialog.getByText('Budget / goals / tolerance coverage',{exact:true}).click();for(const [key,value]of [['Optical budget','512'],['Geometry budget','8'],['Local fit budget','64']]){await dialog.getByLabel('Synthesis '+key,{exact:true}).fill(value);await dialog.getByLabel('Synthesis '+key,{exact:true}).blur();}
 await dialog.getByRole('button',{name:'Run Automatic Synthesis',exact:true}).click();await expect(dialog.getByTestId('synthesis-metrics')).toContainText('Nominal Mode goals met',{timeout:90000});await expect(dialog.getByTestId('lens-motion-table')).toBeVisible();await expect(dialog.getByTestId('lens-motion-table').locator('tbody tr')).toHaveCount(2);await page.screenshot({path:`test-results/D24-small-offset-${info.project.name}.png`,fullPage:true});
 await dialog.getByRole('button',{name:'Apply Synthesis Candidate',exact:true}).click();const after=await save(page);expect(after.model.prescription.source).toEqual(before.model.prescription.source);expect(after.model.prescription.surfaces.at(-1)).toEqual(before.model.prescription.surfaces.at(-1));expect(after.authoring).toEqual(before.authoring);expect(after.synthesis.solution.qualified).toBe(true);expect(after.synthesis.lensAlignment).toEqual({decenter:.001,tilt:.02});
 await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await save(page)).toEqual(before);
});
