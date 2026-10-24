import{test,expect}from'@playwright/test';
import{readFile}from'node:fs/promises';
import{resolve}from'node:path';
import{pathToFileURL}from'node:url';
import{tab}from'./ui';
import type{Page}from'@playwright/test';
async function save(page:Page){await tab(page,'Layout');const d=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project JSON',exact:true}).click();return JSON.parse(await readFile((await(await d).path())!,'utf8'));}
async function view(page:Page,v:string){await page.getByRole('button',{name:v+' View',exact:true}).click();}
async function addPrism(page:Page){await tab(page,'Layout');await page.getByRole('button',{name:'Add Component',exact:true}).click();await page.getByLabel('Component type',{exact:true}).selectOption('prism');for(const [k,v]of[['X','1.1'],['Y','-0.2'],['Z','0.35']])await page.getByLabel('Insert '+k,{exact:true}).fill(v);await page.getByLabel('Insert yaw',{exact:true}).fill('12');await page.getByRole('button',{name:'Insert at Position',exact:true}).click();await tab(page,'Layout');}
for(const start of ['Gaussian','Surface','Report'])test(`Prism inserted in ${start} persists across every view and common Undo/Save`,async({page})=>{
 await page.goto('/');await page.getByLabel('Project Example',{exact:true}).selectOption('lens');await view(page,start);const original=await save(page);
 await page.evaluate(()=>{const w=window as any;w.header=document.querySelector('.app-header');w.menu=document.querySelector('[aria-label="Project controls"]');w.example=document.querySelector('[aria-label="Project Example"]');w.inspector=document.querySelector('.surface-inspector');});
 await addPrism(page);const added=await save(page),block=added.bodies.find((b:any)=>b.kind==='prism'),a=added.model.prescription.assemblies.find((a:any)=>a.id===block.assemblyId),surface=added.model.prescription.surfaces.find((s:any)=>s.assemblyId===a.id);
 expect(a.frame.origin).toEqual({x:.0011,y:-.0002,z:.00035});expect(a.frame.rotation.yaw).toBeCloseTo(Math.PI/15,12);expect(added.model.prescription.surfaces.at(-1)).toEqual(original.model.prescription.surfaces.at(-1));
 for(const v of ['Gaussian','Surface','Report']){await view(page,v);expect(await save(page)).toEqual(added);expect(await page.evaluate(()=>{const w=window as any;return w.header===document.querySelector('.app-header')&&w.menu===document.querySelector('[aria-label="Project controls"]')&&w.example===document.querySelector('[aria-label="Project Example"]')&&w.inspector===document.querySelector('.surface-inspector');})).toBe(true);}
 await expect(page.getByTestId('report-figure').locator(`[data-defined-body="${a.id}"]`).first()).toBeVisible();
 await tab(page,'Surfaces');await page.getByTestId('assembly-'+a.id).click();await page.getByLabel('Prism Depth',{exact:true}).fill('1.25');await page.getByLabel('Assembly X',{exact:true}).fill('1.4');await tab(page,'Layout');const edited=await save(page);expect(edited.bodies.find((b:any)=>b.assemblyId===a.id).depth).toBeCloseTo(.00125,12);
 await view(page,'Report');await page.getByLabel('Report selected Surface',{exact:true}).selectOption(surface.id);const dl=page.waitForEvent('download');await page.locator('.report-inline').getByRole('button',{name:'SVG',exact:true}).click();const svg=await readFile((await(await dl).path())!,'utf8');expect(svg).toContain('0.00125');expect(svg).toContain(surface.id);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await save(page)).toEqual(added);await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await save(page)).toEqual(original);await page.getByRole('button',{name:'Redo',exact:true}).click();expect(await save(page)).toEqual(added);
 await page.getByTestId('surface-json-input').setInputFiles({name:'shared.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(edited))});expect(await save(page)).toEqual(edited);
});
test('view switch preserves ideal inputs, physics, selection and Gaussian/report cameras',async({page})=>{
 await page.goto('/');await page.getByLabel('Project Example',{exact:true}).selectOption('ideal:pointing');await expect(page.getByTestId('summary-eta')).toHaveText('92.4465%');await page.getByRole('button',{name:'Zoom in',exact:true}).click();
 await tab(page,'Surfaces');await page.getByTestId('tree-lens-f').click();const f=page.getByLabel('Focal Length',{exact:true});await f.fill('1.4');const before=await save(page);await view(page,'Report');await expect(page.getByTestId('report-gaussian-envelope').first()).toBeVisible();await page.getByRole('button',{name:'Report zoom in',exact:true}).click();
 await view(page,'Surface');await view(page,'Gaussian');await expect(page.getByTestId('zoom-level')).toHaveText('125%');await tab(page,'Inspect');await expect(f).toHaveValue('1.4');await tab(page,'Layout');await view(page,'Report');await expect(page.locator('.report-footer output')).toHaveText('120%');expect(await save(page)).toEqual(before);
});
test('offline view/palette controls fit 320–1920px and do not open a second workspace',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.context().setOffline(true);await page.goto(pathToFileURL(resolve('dist/index.html')).href+'#surfaces');
 for(const width of info.project.name==='desktop'?[320,412,768,1366,1920]:[412]){await page.setViewportSize({width,height:1000});for(const v of ['Gaussian','Surface','Report']){await tab(page,'Layout');await view(page,v);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('.app-shell')).toHaveCount(1);await page.screenshot({path:`test-results/P2.4-${info.project.name}-${width}-${v}.png`,fullPage:true});}}
 await page.getByRole('button',{name:'Add Component',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Add Component',exact:true});await expect(dialog).toBeVisible();await page.getByRole('button',{name:'Close Add Component',exact:true}).click();expect(errors).toEqual([]);
});

test('report keyboard selection updates the shared inspector and has one focus target per Surface',async({page})=>{
 await page.goto('/#surfaces');await page.getByRole('button',{name:'Report View',exact:true}).click();
 const figure=page.getByTestId('report-figure'),button=figure.getByRole('button',{name:'Select report Surface P-TIR',exact:true});await expect(button).toHaveCount(1);await button.focus();await button.press('Enter');await expect(page.getByLabel('Report selected Surface',{exact:true})).toHaveValue('P-TIR');
 await tab(page,'Inspect');await expect(page.getByLabel('Surface Name',{exact:true})).toHaveValue('P-TIR');await tab(page,'Layout');await page.getByRole('button',{name:'Surface View',exact:true}).click();await tab(page,'Surfaces');await expect(page.getByTestId('surface-tree-P-TIR')).toHaveClass(/selected/);
});
