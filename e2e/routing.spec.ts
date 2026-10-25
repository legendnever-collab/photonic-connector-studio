import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
const offline=pathToFileURL(resolve('dist/index.html')).href;
async function save(page:Page){const dl=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project JSON',exact:true}).click();return JSON.parse(await readFile((await(await dl).path())!,'utf8'));}
async function example(page:Page,which='mirrors'){await page.getByLabel('Project Example',{exact:true}).selectOption(`routing:${which}`);await page.getByRole('button',{name:'Design Setup',exact:true}).click();}
test.beforeEach(async({page},info)=>{test.skip(info.project.name!=='desktop','PC-first Port routing checkpoint.');await page.context().setOffline(true);await page.goto(offline);});
test('manual Mirror example exposes µm Global Ports and the independent zero-error reference ray',async({page})=>{
 await example(page);await expect(page.getByLabel('Input Global Z',{exact:true})).toHaveValue('-10');await expect(page.getByLabel('Output Global Z',{exact:true})).toHaveValue('50');await expect(page.getByLabel('Output Device',{exact:true})).toHaveValue('pic-edge');
 await expect(page.getByTestId('routing-status')).toHaveText('Within geometric tolerances');await expect(page.getByTestId('routing-position-error')).toHaveText('0');await expect(page.getByTestId('routing-angle-error')).toHaveText('0');await expect(page.getByTestId('surface-reached')).toHaveText('13 / 13');
 const before=await save(page);await page.getByRole('button',{name:'Focus Folds',exact:true}).click();await expect(page.getByRole('button',{name:'XZ',exact:true})).toHaveAttribute('aria-pressed','true');expect(await save(page)).toEqual(before);
 await page.screenshot({path:'test-results/S0-S1-mirror-focus.png',fullPage:true});
});
test('Output position/angle editing updates the common Surface, keeps numeric focus and supports Undo / SaveLoad',async({page})=>{
 await example(page);const before=await save(page);await page.getByLabel('Output Global Y',{exact:true}).fill('3');await page.getByLabel('Output Global Z',{exact:true}).fill('54');await expect(page.getByLabel('Output Global Z',{exact:true})).toBeFocused();
 await expect(page.getByTestId('routing-position-error')).toHaveText('5');await expect(page.getByTestId('routing-status')).toHaveText('Outside geometric tolerances');
 const next=await save(page);expect(next.model.prescription.surfaces.slice(0,-1)).toEqual(before.model.prescription.surfaces.slice(0,-1));expect(next.model.prescription.assemblies).toEqual(before.model.prescription.assemblies);expect(next.model.prescription.surfaces.at(-1).frame.origin.y).toBeCloseTo(3e-6,14);
 await page.getByLabel('Output Global yaw',{exact:true}).fill('1');await expect(page.getByTestId('routing-angle-error')).toHaveText('1');await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await save(page)).toEqual(next);
 await page.getByTestId('surface-json-input').setInputFiles({name:'routing.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(next))});await page.getByRole('button',{name:'Design Setup',exact:true}).click();await expect(page.getByLabel('Output Global Z',{exact:true})).toHaveValue('54');expect(await save(page)).toEqual(next);
});
test('Prism +Z incidence uses the same Report geometry and withholds unsupported Coupling',async({page})=>{
 await example(page,'prism');await expect(page.getByTestId('target-direction')).toContainText('0 / 0 / 1');await expect(page.getByTestId('routing-status')).toHaveText('Within geometric tolerances');
 const before=await save(page);await page.getByRole('button',{name:'Report View',exact:true}).click();await expect(page.getByTestId('report-figure')).toBeVisible();await expect(page.getByTestId('report-figure').locator('[data-defined-body="Fold-Prism"]').first()).toBeVisible();
 const dl=page.waitForEvent('download');await page.locator('.report-inline').getByRole('button',{name:'SVG',exact:true}).click();const svg=await readFile((await(await dl).path())!,'utf8');expect(svg).toContain('pic-grating');expect(svg).toContain('positionTolerance');expect(svg).toContain('P-TIR');
 await page.getByRole('button',{name:'Gaussian View',exact:true}).click();await expect(page.getByTestId('physical-gaussian-status')).toHaveText('out-of-domain');await expect(page.getByTestId('physical-gaussian-reason')).toContainText('Folded paths');await page.getByRole('button',{name:'Analysis',exact:true}).click();await expect(page.getByTestId('mode-overlap')).toHaveText('Not calculated');expect(await save(page)).toEqual(before);
 await page.getByRole('button',{name:'Surface View',exact:true}).click();await page.getByRole('button',{name:'Fit',exact:true}).click();await page.screenshot({path:'test-results/S0-S1-prism.png',fullPage:true});
});
test('space/part constraints and invalid numeric drafts have explicit status and survive SaveLoad',async({page})=>{
 await example(page);await page.getByText('Design Space / Part Limits',{exact:true}).click();await page.getByLabel('Max mirror',{exact:true}).fill('1');await expect(page.getByTestId('routing-diagnostics')).toContainText('part limit exceeded');await expect(page.getByTestId('routing-status')).toHaveText('Outside geometric tolerances');
 await page.getByLabel('Max mirror',{exact:true}).fill('2');await page.getByLabel('Space max X',{exact:true}).fill('3');await expect(page.getByTestId('routing-diagnostics')).toContainText('outside Design Space');
 await page.getByLabel('Space max X',{exact:true}).fill('5');await page.getByLabel('Position Tolerance',{exact:true}).fill('0');await expect(page.getByLabel('Position Tolerance',{exact:true})).toHaveAttribute('aria-invalid','true');await expect(page.getByTestId('routing-summary')).toHaveCount(0);
 await page.getByLabel('Position Tolerance',{exact:true}).press('Enter');await expect(page.getByLabel('Position Tolerance',{exact:true})).toHaveValue('1');await expect(page.getByTestId('routing-status')).toHaveText('Within geometric tolerances');
 await page.getByRole('button',{name:'Add Keep-out Box',exact:true}).click();const p=await save(page);expect(p.routing.keepOut).toHaveLength(1);expect(p.routing.parts.mirror).toBe(2);
});
test('Design Setup reopens a closed inspector; device choice clears the Fiber shell without losing the mode',async({page})=>{
 const before=await save(page);await page.getByRole('button',{name:'Close Properties / Analysis',exact:true}).click();await page.getByRole('button',{name:'Design Setup',exact:true}).click();await expect(page.getByTestId('design-setup')).toBeVisible();expect(await save(page)).toEqual(before);
 await page.getByLabel('Output Device',{exact:true}).selectOption('pic-grating');await expect(page.getByTestId('layout-body-@target')).toHaveCount(0);let p=await save(page);expect(p.authoring.ports.target.device).toBe('pic-grating');expect(p.model.targetMode.mfdX).toBeCloseTo(9.2e-6,14);
 await page.getByLabel('Output Direction preset',{exact:true}).selectOption('+Z');await expect(page.getByTestId('target-direction')).toContainText('0 / 0 / 1');
 await page.getByLabel('Output Device',{exact:true}).selectOption('fiber');await expect(page.getByTestId('layout-body-@target')).toBeVisible();p=await save(page);expect(p.authoring.ports.target.preset).toBe('smf-1310-gaussian');
 for(const [width,height]of [[1366,768],[1440,1000]]){await page.setViewportSize({width,height});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.getByLabel('Output Global X',{exact:true})).toBeVisible();}
});
