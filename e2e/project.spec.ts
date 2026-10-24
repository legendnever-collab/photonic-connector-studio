import { tab as unifiedTab } from './ui';
import { test,expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const tab=unifiedTab;
async function save(page:Page){await tab(page,'Layout');const d=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project JSON',exact:true}).click();return JSON.parse(await readFile((await(await d).path())!,'utf8'));}
async function assembly(page:Page,id:string){await tab(page,'Surfaces');if(await page.getByTestId('assembly-'+id).count())await page.getByTestId('assembly-'+id).click();else{await page.getByTestId('tree-'+id).click();await page.getByLabel('Surface Edit Target',{exact:true}).selectOption('assembly');}}
async function finish(page:Page){await page.getByRole('button',{name:'편집 종료 · Layout',exact:true}).last().click();}
async function report(page:Page){await tab(page,'Layout');await page.getByRole('button',{name:'Report View',exact:true}).click();}

test('ideal Gaussian, Surface positions, report envelope and global Undo use one project',async({page})=>{
 await page.goto('/');await page.getByLabel('Project Example',{exact:true}).selectOption('ideal:pointing');
 await expect(page.getByTestId('summary-eta')).toHaveText('92.4465%');await page.getByRole('button',{name:'Zoom in',exact:true}).click();
 await page.getByRole('button',{name:'Surface View',exact:true}).click();
 const before=await save(page);expect(before.kind).toBe('optical-project');expect(before.model.kind).toBe('ideal');expect(before.bodies).toEqual([]);
 const lens=before.model.design.components.find((c:any)=>c.kind==='lens');
 await assembly(page,lens.id);const x=page.getByLabel('Assembly X',{exact:true});await x.fill('2.1');await finish(page);
 const after=await save(page);expect(after.model.design.components.find((c:any)=>c.id===lens.id).frame.origin.x).toBeCloseTo(.0021,12);
 await report(page);await expect(page.getByTestId('report-gaussian-envelope').first()).toBeVisible();await expect(page.getByTestId('report-figure')).toContainText('Ideal Gaussian');
 await page.getByRole('button',{name:'Surface View',exact:true}).click();
 await page.getByRole('button',{name:'Gaussian View',exact:true}).click();
 const gaussian=page.locator('.app-shell:visible');await expect(gaussian.getByLabel(`${lens.name} X table`,{exact:true})).toHaveValue('2.1');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByTestId('zoom-level')).toHaveText('125%');await page.getByRole('button',{name:'Surface View',exact:true}).click();expect(await save(page)).toEqual(before);
 await page.getByRole('button',{name:'Redo',exact:true}).click();expect(await save(page)).toEqual(after);
});
test('physical block thickness, modes, selection and report dimensions persist across workspaces',async({page})=>{
 await page.goto('/#surfaces');await page.getByLabel('Project Example',{exact:true}).selectOption('lens');
 await assembly(page,'Lens');const thickness=page.getByLabel('Center Thickness',{exact:true});
 for(const v of ['1.1','1.2','1.3']){await thickness.fill(v);await expect(thickness).toBeFocused();}
 await page.getByLabel('Body Outer Radius',{exact:true}).fill('1.4');await finish(page);
 const edited=await save(page);expect(edited.model.prescription.surfaces[1].frame.origin.x).toBeCloseTo(.0013,12);expect(edited.bodies[0].outerRadius).toBeCloseTo(.0014,12);
 await page.getByRole('button',{name:'Gaussian View',exact:true}).click();await expect(page.getByTestId('gaussian-support')).toContainText('Not calculated');
 await tab(page,'Surfaces');await page.getByTestId('shared-source').click();const g=page.locator('.unified-workstation');await g.getByLabel('Source MFD X',{exact:true}).fill('20');await g.getByLabel('Source MFD Y',{exact:true}).fill('25');await finish(page);await tab(page,'Surfaces');await page.getByTestId('surface-tree-L1-back').click();await finish(page);
 const promise=page.waitForEvent('download');await g.getByRole('button',{name:'Save Project JSON',exact:true}).click();const common=JSON.parse(await readFile((await(await promise).path())!,'utf8'));expect(common.model.sourceMode.mfdX).toBeCloseTo(.00002,12);expect(common.model.prescription).toEqual(edited.model.prescription);
 await page.getByRole('button',{name:'Surface View',exact:true}).click();await expect(page.getByTestId('surface-tree-L1-back')).toHaveClass(/selected/);
 await report(page);const dialog=page.locator('.report-inline');await dialog.getByRole('button',{name:'C · Linked Inspector',exact:true}).click();await expect(dialog.getByLabel('Report selected Surface',{exact:true})).toHaveValue('L1-back');
 const download=page.waitForEvent('download');await dialog.getByRole('button',{name:'SVG',exact:true}).click();const svg=await readFile((await(await download).path())!,'utf8');expect(svg).toContain('0.0014');expect(svg).toContain('sourceMode');
 await page.getByRole('button',{name:'Surface View',exact:true}).click();
 await page.getByRole('button',{name:'Undo',exact:true}).click();const undone=await save(page);expect(undone.model.sourceMode.mfdY).toBeNull();expect(undone.bodies).toEqual(edited.bodies);
});
test('finite prism/mirror body dimensions affect physical acceptance, independently of MFD',async({page})=>{
 await page.goto('/#surfaces');await page.getByLabel('Project Example',{exact:true}).selectOption('prism');await assembly(page,'Prism');
 await page.getByLabel('Prism Depth',{exact:true}).fill('0.05');await finish(page);await expect(page.getByTestId('surface-reached')).not.toHaveText('13 / 13');
 await report(page);await expect(page.getByTestId('report-figure')).toContainText('Defined body dimensions');await page.getByRole('button',{name:'Surface View',exact:true}).click();
 await page.getByLabel('Project Example',{exact:true}).selectOption('mirror');await assembly(page,'Mirror');await page.getByLabel('Body Outline',{exact:true}).selectOption('rectangle');await page.getByLabel('Body Width',{exact:true}).fill('0.1');await page.getByLabel('Body Height',{exact:true}).fill('0.1');await finish(page);await expect(page.getByTestId('surface-reached')).toHaveText('1 / 13');
 const before=await save(page);await tab(page,'Surfaces');await page.getByTestId('shared-source').click();await page.getByLabel('Source MFD X',{exact:true}).fill('40');await finish(page);const after=await save(page);expect(after.bodies).toEqual(before.bodies);expect(after.model.prescription.source.radius).toBe(before.model.prescription.source.radius);await expect(page.getByTestId('surface-reached')).toHaveText('1 / 13');
});
test('common and legacy imports preserve model class, reject unknown references and omit unknown solids',async({page})=>{
 await page.goto('/#surfaces');const original=await save(page);
 const input=page.getByTestId('surface-json-input');await input.setInputFiles({name:'project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(original))});expect(await save(page)).toEqual(original);
 await input.setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...original,bodies:[{kind:'prism',assemblyId:'missing',depth:.01}]}))});await expect(page.getByRole('alert')).toContainText('Import rejected');expect(await save(page)).toEqual(original);
 await input.setInputFiles({name:'legacy-surface.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(original.model.prescription))});const legacy=await save(page);expect(legacy.bodies).toEqual([]);expect(legacy.sourceBody).toBeNull();await report(page);await expect(page.getByTestId('report-figure').locator('[data-defined-body]')).toHaveCount(0);await page.getByRole('button',{name:'Surface View',exact:true}).click();
});
test('offline common project works at narrow widths and invalid drafts suppress report results',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.context().setOffline(true);await page.goto(pathToFileURL(resolve('dist/index.html')).href+'#surfaces');
 for(const width of info.project.name==='desktop'?[320,768,1440]:[412]){await page.setViewportSize({width,height:1000});await tab(page,'Layout');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole('button',{name:'Gaussian View',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole('button',{name:'Surface View',exact:true}).click();}
 await assembly(page,'Mirror');const width=page.getByLabel('Body Diameter',{exact:true});await width.fill('');await expect(page.getByTestId('surface-reached')).toHaveText('Not calculated');await width.press('Enter');await finish(page);await expect(page.getByTestId('surface-reached')).toHaveText('45 / 45');expect(errors).toEqual([]);
});

test('locked Gaussian components remain locked in the Surface editor and shared Mode fields',async({page})=>{
 await page.goto('/');await page.getByLabel('Project Example',{exact:true}).selectOption('ideal:pointing');await page.getByRole('button',{name:'Surface View',exact:true}).click();
 const p=await save(page);p.model.design.components[0].locked=true;p.model.design.components[1].locked=true;
 await page.getByTestId('surface-json-input').setInputFiles({name:'locked.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
 await assembly(page,p.model.design.components[1].id);await expect(page.getByLabel('Assembly X',{exact:true})).toBeDisabled();await finish(page);
 await tab(page,'Surfaces');await page.getByTestId('tree-fiber').click();await expect(page.getByLabel('MFDx',{exact:true})).toBeDisabled();await expect(page.getByLabel('X Position',{exact:true})).toBeDisabled();await finish(page);expect(await save(page)).toEqual(p);
});
