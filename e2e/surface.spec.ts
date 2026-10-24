import { tab as unifiedTab } from './ui';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const tab=unifiedTab;
async function example(page: Page, id: string) { await tab(page, 'Layout'); await page.getByLabel('Project Example', { exact: true }).selectOption(id); }
async function select(page: Page, id: string) { await tab(page, 'Surfaces'); await page.getByTestId(`surface-tree-${id}`).click(); }
async function save(page: Page) { await tab(page, 'Layout'); const promise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save Project JSON', exact: true }).click(); const project=JSON.parse(await readFile((await (await promise).path())!, 'utf8'));return project.kind==='optical-project'?project.model.prescription:project; }
async function analysis(page: Page) { await tab(page, 'Analysis'); const nav = page.getByRole('navigation', { name: 'Surface Inspector tabs' }); if (await nav.isVisible())
    await nav.getByRole('button', { name: 'Analysis', exact: true }).click(); }
test.beforeEach(async ({ page }) => { await page.goto('/#surfaces'); });
test('all physical examples reach targets and table selection exposes local Surface frames', async ({ page }) => {
    for (const [id, expected] of [['lens', '13 / 13'], ['mirror', '13 / 13'], ['prism', '13 / 13'], ['array', '45 / 45'], ['compound', '45 / 45']]) {
        await example(page, id);
        await expect(page.getByTestId('surface-reached')).toHaveText(expected);
    }
    await select(page, 'P-TIR');
    await expect(page.getByLabel('Surface Interaction', { exact: true })).toHaveValue('tir');
    await expect(page.getByLabel('TIR Outside Index', { exact: true })).toHaveValue('1');
    await expect(page.getByLabel('Local X', { exact: true })).toHaveValue('2');
    await page.getByRole('button', { name: '편집 종료 · Layout', exact: true }).last().click();
    await analysis(page);
    await expect(page.getByTestId('surface-termination')).toContainText('0 / 45 blocked');
});
test('mirror edits continuously update rays without replacing canvas, surface nodes or camera', async ({ page }) => {
    await example(page, 'mirror');
    await page.getByRole('button', { name: 'Zoom Surface In', exact: true }).click();
    await page.evaluate(() => { const w = window as any; w.surfaceSVG = document.querySelector('[data-testid="surface-canvas"]'); w.node = document.querySelector('[data-testid="surface-node-M1-0:0"]'); w.ray = document.querySelector('[data-testid="surface-ray-0"]'); w.points = w.ray.getAttribute('points'); });
    await select(page, 'M1');
    const yaw = page.getByLabel('Local Yaw', { exact: true });
    for (const value of ['1', '2', '3']) {
        await yaw.fill(value);
        await expect(yaw).toBeFocused();
    }
    await page.getByRole('button', { name: '편집 종료 · Layout', exact: true }).last().click();
    expect(await page.evaluate(() => { const w = window as any; return w.surfaceSVG === document.querySelector('[data-testid="surface-canvas"]') && w.node === document.querySelector('[data-testid="surface-node-M1-0:0"]') && w.ray === document.querySelector('[data-testid="surface-ray-0"]') && w.points !== w.ray.getAttribute('points'); })).toBe(true);
    await expect(page.getByTestId('surface-zoom')).toHaveText('125%');
});
test('invalid drafts suppress current trace; clipping and failed TIR remain explicit', async ({ page }) => {
    await example(page, 'prism');
    await select(page, 'P-entry');
    const clear = page.getByLabel('Clear Radius', { exact: true });
    await clear.fill('');
    await expect(page.getByTestId('surface-reached')).toHaveText('Not calculated');
    await expect(page.getByTestId('surface-rays')).toHaveCount(0);
    await clear.press('Enter');
    await expect(clear).toHaveValue('1.5');
    await expect(page.getByTestId('surface-reached')).toHaveText('13 / 13');
    await clear.fill('0.001');
    await page.getByRole('button', { name: '편집 종료 · Layout', exact: true }).last().click();
    await analysis(page);
    await expect(page.getByText('P-entry: aperture / cell clipping', { exact: true })).toBeVisible();
    await example(page, 'prism');
    await select(page, 'P-TIR');
    await page.getByLabel('TIR Outside Index', { exact: true }).fill('1.4');
    await page.getByRole('button', { name: '편집 종료 · Layout', exact: true }).last().click();
    await analysis(page);
    await expect(page.getByText('P-TIR: TIR condition not met', { exact: true })).toBeVisible();
});
test('Assembly pivot preserves child local definitions, JSON roundtrip and Undo/Redo', async ({ page }) => {
    const before = await save(page);
    await tab(page, 'Surfaces');
    await page.getByTestId('assembly-Module').click();
    await expect(page.getByLabel('Assembly Name', { exact: true })).toHaveValue('Module');
    await page.getByLabel('Assembly Roll', { exact: true }).fill('5');
    const edited = await save(page);
    expect(edited.surfaces).toEqual(before.surfaces);
    expect(edited.assemblies.find((a: any) => a.id === 'Module').frame.rotation.roll).toBeCloseTo(5 * Math.PI / 180, 10);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect(await save(page)).toEqual(before);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    expect(await save(page)).toEqual(edited);
    await example(page, 'lens');
    await page.getByTestId('surface-json-input').setInputFiles({ name: 'compound.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(edited)) });
    expect(await save(page)).toEqual(edited);
    await page.getByTestId('surface-json-input').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
    await expect(page.getByRole('alert')).toContainText('Import rejected');
    expect(await save(page)).toEqual(edited);
});
test('3D shading, camera orbit and standalone SVG export preserve prescription', async ({ page }) => {
    const before = await save(page);
    await page.getByRole('button', { name: '3D', exact: true }).click();
    await page.getByLabel('Presentation Shading', { exact: true }).check();
    const box = await page.getByTestId('surface-canvas').boundingBox();
    const ray = await page.getByTestId('surface-ray-0').getAttribute('points');
    await page.mouse.move(box!.x + 20, box!.y + 70);
    await page.mouse.down();
    await page.mouse.move(box!.x + 80, box!.y + 100, { steps: 8 });
    await page.mouse.up();
    expect(await page.getByTestId('surface-ray-0').getAttribute('points')).not.toBe(ray);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'SVG', exact: true }).click();
    const svg = await readFile((await (await download).path())!, 'utf8');
    expect(svg).toContain('http://www.w3.org/2000/svg');
    expect(svg.includes('var(--')).toBe(false);
    expect(svg.includes('file:///')).toBe(false);
    expect(svg).toContain('surface-sequential-3d/2.1.0');
    expect(svg).toContain('Computed geometric rays');
    expect(await save(page)).toEqual(before);
});
test('source tilt and Gaussian switching retain the shared physical project', async ({ page }) => {
    await example(page, 'mirror');
    await select(page, 'M1');
    await page.getByLabel('Surface Edit Target', { exact: true }).selectOption('source');
    await page.getByLabel('Source Yaw', { exact: true }).fill('1');
    const d = await save(page);
    expect(d.source.frame.rotation.yaw).toBeCloseTo(Math.PI / 180, 12);
    await page.getByRole('button', { name: 'Gaussian View', exact: true }).click();
    await expect(page.getByTestId('gaussian-support')).toContainText('Not calculated');
    await page.getByRole('button', { name: 'Surface View', exact: true }).click();
    expect(await save(page)).toEqual(d);
});
test('offline responsive workbench and mobile keyboard exit remain usable', async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.context().setOffline(true);
    await page.goto(pathToFileURL(resolve('dist/index.html')).href + '#surfaces');
    await expect(page.getByTestId('surface-reached')).toHaveText('45 / 45');
    const widths = info.project.name === 'desktop' ? [320, 360, 412, 768, 1366, 1600] : [412];
    for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 });
        await tab(page, 'Layout');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.getByRole('button', { name: '3D', exact: true }).click();
        await page.getByLabel('Presentation Shading', { exact: true }).check();
        await page.screenshot({ path: `test-results/P2.1-${info.project.name}-${width}.png`, fullPage: true });
    }
    if (info.project.name === 'mobile') {
        await select(page, 'MLA-front');
        await page.evaluate(() => { document.documentElement.style.setProperty('--visible-height', '500px'); document.documentElement.style.setProperty('--visible-top', '0px'); });
        const exit = page.getByRole('button', { name: '편집 종료 · Layout', exact: true }).last();
        const box = await exit.boundingBox();
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.y + box!.height).toBeLessThanOrEqual(500);
        await exit.click();
        await expect(page.getByTestId('surface-canvas')).toBeVisible();
    }
    expect(errors).toEqual([]);
});
test('inline Surface table and inserted probe share one undoable prescription', async ({ page }, info) => {
    const before = await save(page);
    if (info.project.name === 'desktop') {
        await page.getByLabel('S1 Radius', { exact: true }).fill('6');
        const updated = await save(page);
        expect(updated.surfaces[0].radius).toBe(.006);
        await page.getByRole('button', { name: 'Undo', exact: true }).click();
    }
    await tab(page, 'Surfaces');
    await tab(page,'Layout');await page.getByRole('button',{name:'Add Component',exact:true}).click();await page.getByLabel('Component type',{exact:true}).selectOption('probe');await page.getByRole('button',{name:'Insert at Position',exact:true}).click();
    let added = await save(page);
    expect(added.surfaces).toHaveLength(before.surfaces.length + 1);
    await expect(page.getByTestId('surface-reached')).toHaveText('45 / 45');
    await tab(page, 'Surfaces');
    await page.getByTestId(`surface-tree-${added.surfaces.find((s:any)=>s.id.startsWith('Probe-')).id}`).click();
    await page.getByRole('button', { name: 'Remove Surface', exact: true }).click();
    expect((await save(page)).surfaces).toEqual(before.surfaces);
    await tab(page, 'Surfaces');
    await tab(page,'Layout');await page.getByRole('button',{name:'Add Component',exact:true}).click();await page.getByLabel('Component type',{exact:true}).selectOption('probe');await page.getByRole('button',{name:'Insert at Position',exact:true}).click();
    added = await save(page);
    expect(added.surfaces).toHaveLength(before.surfaces.length + 1);
    await expect(page.getByTestId('surface-reached')).toHaveText('45 / 45');
});
