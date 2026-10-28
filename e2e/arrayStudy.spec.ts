import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {tab} from './ui';
const offline=pathToFileURL(resolve('dist/index.html')).href;
async function openExample(page:Page,name:'Mirror 방향 전환'|'공용 2-Lens Relay'){
 await page.getByRole('button',{name:'Templates',exact:true}).click();const d=page.getByRole('dialog',{name:'Templates',exact:true});await d.getByText('고급 시작 조건·기술 검증 예시',{exact:true}).click();
 if(name==='Mirror 방향 전환')await d.getByRole('button',{name:'Vertical Coupling',exact:true}).click();
 await d.getByRole('button',{name:`계산 예시 열기 · ${name}`,exact:true}).click();await tab(page,'Analysis');
 const panel=page.getByRole('region',{name:'Array Channel Study'});await panel.getByRole('button',{name:'Channel별 비교 실행',exact:true}).click();await expect(panel.getByTestId('array-study-results')).toBeVisible();return panel;
}
test.beforeEach(async({page})=>{await page.context().setOffline(true);await page.goto(offline);});
test('real mirror example evaluates every channel, exports results, invalidates edits and preserves settings',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const panel=await openExample(page,'Mirror 방향 전환');await expect(panel.getByTestId('array-study-results')).toContainText('Nominal 8/8 · Changed 8/8 · complete');
 const download=page.waitForEvent('download');await panel.getByRole('button',{name:'Channel 결과 JSON',exact:true}).click();const r=JSON.parse(await readFile((await(await download).path())!,'utf8'));expect(r.rows).toHaveLength(8);expect(r.perturbedSummary.worstChannel).toBe(8);expect(r.totalCoupling).toBeNull();
 await tab(page,'Layout');await page.getByRole('button',{name:'Report View',exact:true}).click();const report=page.locator('.report-inline');expect((await report.locator('.report-paper-wrap').boundingBox())!.height).toBeGreaterThanOrEqual(200);await expect(report.getByTestId('array-study-results')).toContainText('Nominal 8/8');await expect(report.getByTestId('report-joint-line')).toContainText('8/8 nominal');
 const svgDownload=page.waitForEvent('download');await report.getByRole('button',{name:'SVG',exact:true}).click();const svg=await readFile((await(await svgDownload).path())!,'utf8'),meta=await page.evaluate(text=>JSON.parse(new DOMParser().parseFromString(text,'image/svg+xml').querySelector('metadata')!.textContent!),svg);expect(svg).toContain("@font-face");expect(svg).toContain("data:font/woff;base64,");expect(meta.arrayChannelStudy).toEqual(r);expect(meta.arrayAssessment.status).toBe('complete');expect(meta.designScenario.reference).toContain('Mirror Array');
 await page.screenshot({path:`test-results/A1-mirror-report-${info.project.name}.png`,fullPage:true});await page.getByRole('button',{name:'Surface View',exact:true}).click();await tab(page,'Analysis');await panel.getByText('Output 정렬·Pitch 변화 설정',{exact:true}).click();await panel.getByLabel('Output Pitch 오차 Y',{exact:true}).fill('1');await panel.getByLabel('Output Pitch 오차 Y',{exact:true}).blur();await expect(panel.getByTestId('array-study-results')).toHaveCount(0);await expect(panel).toContainText('다시 계산');
 await tab(page,'Layout');const saved=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project JSON',exact:true}).click();const project=JSON.parse(await readFile((await(await saved).path())!,'utf8'));expect(project.arrayStudy.outputPitchY).toBe(1e-6);expect(project.designScenario).toBe('mirror-reference');
 await page.getByRole('button',{name:'Report View',exact:true}).click();await expect(report.getByTestId('array-study-results')).toHaveCount(0);await expect(report.getByTestId('report-joint-line')).toContainText('Array overlap / tolerance not assessed');expect(errors).toEqual([]);
});
test('two-lens example exposes partial coverage without whole-array averages',async({page},info)=>{
 const panel=await openExample(page,'공용 2-Lens Relay'),result=panel.getByTestId('array-study-results');await expect(result).toContainText('partial');await expect(result).not.toContainText('Nominal 평균');await panel.getByText('Channel별 결과와 미계산 사유',{exact:true}).click();await expect(result.locator('tbody tr')).toHaveCount(8);await expect(result).toContainText('미계산');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/A1-relay-analysis-${info.project.name}.png`,fullPage:true});
});
test('reference templates identify two optical functions and do not pretend to contain vendor prescriptions',async({page})=>{
 await page.getByRole('button',{name:'Templates',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Templates',exact:true});await dialog.getByText('고급 시작 조건·기술 검증 예시',{exact:true}).click();const card=dialog.locator('article').filter({has:page.getByRole('heading',{name:'Edge Coupling · 수직 삽입 Receptacle',exact:true})});await card.getByText('구성·가정·참고 자료',{exact:true}).click();await expect(card).toContainText('Collimation');await expect(card).toContainText('Refocusing');await expect(card).toContainText('p.4–5');await expect(card).toContainText('제공되지 않았습니다');await card.getByRole('button',{name:'이 조건으로 시작 · Edge Coupling · 수직 삽입 Receptacle',exact:true}).click();await page.getByRole('button',{name:'② 연결 조건',exact:true}).click();const guide=page.locator('.unified-design .scenario-guide');await guide.locator('summary').click();await expect(guide).toContainText('FAU → Collimator');
});
