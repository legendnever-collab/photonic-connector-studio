import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {prismFixture} from '../tests/prismFixtures';
import {tensorOverlap} from '../src/project/tensorOverlap';
const gaussianPercent=(eta:number)=>`${Number((eta*100).toPrecision(5))}%`;
import {tab,openProjectExample} from './ui';
const offline=pathToFileURL(resolve('dist/index.html')).href;
async function save(page:Page){await tab(page,'Layout');const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project JSON',exact:true}).click();return JSON.parse(await readFile((await(await pending).path())!,'utf8'));}
async function load(page:Page,p:unknown){await page.getByTestId('surface-json-input').setInputFiles({name:'prism.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});const guard=page.getByRole('dialog',{name:'Unsaved Project',exact:true});if(await guard.isVisible())await guard.getByRole('button',{name:'Discard & Open',exact:true}).click();}
test.beforeEach(async({page})=>{await page.context().setOffline(true);await page.goto(offline);});
test('manual and routing-origin Prism / Mirror share Analysis, Gaussian and Report numbers without synthesis',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const kind of ['one','mixed','two','mirrors'] as const){
  const p=prismFixture(kind),v=tensorOverlap(p);if(v.status!=='valid')throw Error(v.reason);const expected=gaussianPercent(v.eta);
  await load(page,p);await tab(page,'Analysis');await expect(page.getByTestId('mode-overlap')).toHaveText(expected);
  await expect(page.getByTestId('mode-results')).toContainText('Transmission / Total Coupling: 미구현');
  const ledger=page.locator('.coupling-ledger');await expect(ledger).toContainText('Not calculated');
  await tab(page,'Layout');await page.getByRole('button',{name:'Gaussian View',exact:true}).click();await expect(page.getByTestId('physical-overlap')).toContainText(expected);
  const dl=page.waitForEvent('download');await page.getByRole('button',{name:'Export Beam Analysis',exact:true}).click();const exported=JSON.parse(await readFile((await(await dl).path())!,'utf8'));
  expect(exported.modeOverlap.eta).toBeCloseTo(v.eta,12);expect(exported.transmission).toBeNull();expect(exported.totalCoupling).toBeNull();
  await page.getByRole('button',{name:'Report View',exact:true}).click();await expect(page.getByTestId('report-mode-overlap')).toContainText(expected);
  const reportDownload=page.waitForEvent('download');await page.getByRole('button',{name:'SVG',exact:true}).click();
  const svg=await readFile((await(await reportDownload).path())!,'utf8');expect(svg).toContain('conditionalModeOverlap');expect(svg).toContain('transmission');
  expect((await save(page)).synthesis).toBeUndefined();expect(await save(page)).toEqual(JSON.parse(JSON.stringify(p)));
 }
 await page.screenshot({path:`test-results/D221-common-${info.project.name}.png`,fullPage:true});expect(errors).toEqual([]);
});
test('built-in Prism example: explicit polarization edit, reason, one Undo and SaveLoad',async({page},info)=>{
 await openProjectExample(page,'routing:prism-mode');const baseline=await save(page);
 await tab(page,'Analysis');const before=await page.getByTestId('mode-overlap').textContent();expect(before).not.toBe('Not calculated');
 await tab(page,'Layout');await page.getByRole('navigation',{name:'Representation'}).getByRole('button',{name:'Input Mode',exact:true}).click();await tab(page,'Inspect');
 await page.getByLabel('source Mode Polarization',{exact:true}).selectOption('unspecified');await tab(page,'Analysis');
 await expect(page.getByTestId('mode-overlap')).toHaveText('Not calculated');await expect(page.getByTestId('mode-calculation-reason')).toContainText('Input undefined');
 await tab(page,'Layout');await page.getByRole('button',{name:'Undo',exact:true}).click();await tab(page,'Analysis');await expect(page.getByTestId('mode-overlap')).toHaveText(before!);
 await load(page,baseline);await tab(page,'Analysis');await expect(page.getByTestId('mode-overlap')).toHaveText(before!);
 await page.getByTestId('mode-results').getByTestId('mode-domain').getByText('Mode evaluation',{exact:false}).click();
 await page.screenshot({path:`test-results/D221-domain-${info.project.name}.png`,fullPage:true});
 const unsupported=structuredClone(baseline);unsupported.model.sourceMode.mfdX=40e-6;unsupported.model.sourceMode.mfdY=40e-6;await load(page,unsupported);await tab(page,'Analysis');
 await expect(page.getByTestId('mode-overlap')).toHaveText('Not calculated');await expect(page.getByTestId('mode-calculation-reason')).toContainText('Out of domain');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
