import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {parseProject} from '../src/project/model';
import {fixedPorts} from '../tests/benchmark/fixture';
async function save(page:Page){const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project JSON',exact:true}).click();return parseProject(await readFile((await(await pending).path())!,'utf8'));}

test('Golden 001: Search → Preview → Apply → Undo/Redo preserves both Port frames and Modes',async({page},info)=>{
 test.skip(info.project.name!=='desktop','Golden Benchmark desktop lifecycle; existing mount E2E covers mobile.');
 test.setTimeout(180000);const rows:unknown[]=[];
 await page.context().setOffline(true);
 for(const offset of [0,50,-50,100,500]){
  await page.goto(pathToFileURL(resolve('dist/index.html')).href);
  await page.getByRole('button',{name:'1번 예시 열기',exact:true}).click();
  await page.getByLabel('Output Global Z',{exact:true}).fill(String(offset));await page.getByLabel('Output Global Z',{exact:true}).blur();
  await page.getByRole('button',{name:'③ 광학계 설계',exact:true}).click();const before=await save(page),ports=fixedPorts(before);
  const open=async()=>{await page.getByRole('button',{name:'자동 설계 찾기',exact:true}).click();return page.getByRole('dialog',{name:'Automatic Synthesis',exact:true});};
  let dialog=await open();await expect(dialog.getByLabel('Synthesis Lens mounting')).toHaveValue('port-axis');
  await dialog.getByRole('button',{name:'Run Automatic Synthesis',exact:true}).click();await expect(dialog.getByTestId('synthesis-result')).toBeVisible({timeout:60000});
  if(offset===0||offset===500)await expect(dialog.getByTestId('synthesis-metrics')).toContainText('Nominal Mode goals met',{timeout:60000});
  else {await expect(dialog.getByTestId('synthesis-result')).toContainText('0 candidates',{timeout:60000});await expect(dialog.getByRole('button',{name:'Apply Synthesis Candidate',exact:true})).toBeDisabled();}
  await dialog.getByRole('button',{name:'Close',exact:true}).click();expect(await save(page)).toEqual(before);
  if(offset===0||offset===500){
   dialog=await open();await dialog.getByRole('button',{name:'Run Automatic Synthesis',exact:true}).click();await expect(dialog.getByTestId('synthesis-metrics')).toContainText('Nominal Mode goals met',{timeout:60000});
   await dialog.getByRole('button',{name:'Apply Synthesis Candidate',exact:true}).click();const after=await save(page);
   expect(fixedPorts(after)).toEqual(ports);expect(after.synthesis?.solution?.qualified).toBe(true);
   await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await save(page)).toEqual(before);
   await page.getByRole('button',{name:'Redo',exact:true}).click();expect(await save(page)).toEqual(after);
   rows.push({offsetM:offset*1e-6,status:'PASS',stages:['Search','Preview','Apply','Undo','Redo','Save/Load']});
  }else rows.push({offsetM:offset*1e-6,status:'PASS',stages:['Search','Preview','unchanged Save/Load'],apply:'unavailable: no candidate'});
 }
 await mkdir('test-results',{recursive:true});await writeFile('test-results/golden-001-browser.json',JSON.stringify({gitSHA:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),browser:page.context().browser()?.version(),project:info.project.name,rows,status:'PASS'},null,2)+'\n');
});
