import { openProjectExample } from './ui';
import { acceptProjectReplacement } from './ui';
import { tab as unifiedTab } from './ui';
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const tab=unifiedTab;
async function choose(page:Page,id:string){await tab(page,"Train");await page.getByTestId(`tree-${id}`).click();}
async function example(page:Page,id:string){await openProjectExample(page,'ideal:'+id);await acceptProjectReplacement(page);}
async function save(page:Page){await tab(page,"Layout");const d=page.waitForEvent("download");await page.getByRole("button",{name:"Save Project JSON",exact:true}).click();const p=JSON.parse(await readFile((await(await d).path())!,"utf8"));return p.kind==='optical-project'?p.model.design:p;}
test.beforeEach(async({page})=>{await page.goto("/#ideal");});
test("synthetic matching, mismatch, free propagation and reset have benchmark KPIs",async({page})=>{
  await example(page,"matching");await expect(page.getByTestId("summary-eta")).toHaveText("100%");
  await expect(page.getByTestId("beam-overlay")).toBeVisible();
  await tab(page,"Analysis");await expect(page.getByTestId("solver-status")).toContainText("Valid");
  await page.getByText("Curvature · Mode · Waist 상세",{exact:true}).click();
  await expect(page.getByRole("img",{name:"W y mode profile",exact:true})).toBeVisible();
  await tab(page,"Layout");await example(page,"mismatch");await expect(page.getByTestId("summary-eta")).toHaveText("36.7879%");
  await example(page,"free");await expect(page.getByTestId("summary-eta")).not.toHaveText("100%");
  const path=await page.getByTestId("beam-overlay").locator("polygon").getAttribute("points");const pts=path!.split(" ").map(p=>p.split(",").map(Number));
  expect(Math.abs(pts[0][1]-pts.at(-1)![1])).toBeLessThan(Math.abs(pts[Math.floor(pts.length/2)-1][1]-pts[Math.floor(pts.length/2)][1]));
  await openProjectExample(page,'ideal:matching');await acceptProjectReplacement(page);await expect(page.getByTestId("summary-eta")).toHaveText("100%");
});
test("continuous lens editing retains focus, SVG, envelope, camera and responds to position/focal length",async({page})=>{
  await example(page,"matching");await page.getByRole("button",{name:"Zoom in",exact:true}).click();await choose(page,"lens-f");
  await page.evaluate(()=>{const w=window as unknown as Record<string,unknown>;w.svg=document.querySelector('[data-testid="optical-canvas"]');w.env=document.querySelector('[data-testid="beam-overlay"]');w.poly=document.querySelector('[data-testid="beam-overlay"] polygon')?.getAttribute("points");});
  const focal=page.getByLabel("Focal Length",{exact:true});
  for(const value of ["1.3","1.4","1.5","1.6"]){await focal.fill(value);await expect(focal).toBeFocused();}
  await expect(page.getByTestId("summary-eta")).not.toHaveText("100%");
  expect(await page.evaluate(()=>{const w=window as unknown as Record<string,unknown>;return w.svg===document.querySelector('[data-testid="optical-canvas"]')&&w.env===document.querySelector('[data-testid="beam-overlay"]')&&w.poly!==document.querySelector('[data-testid="beam-overlay"] polygon')?.getAttribute("points");})).toBe(true);
  await page.getByLabel("X Position",{exact:true}).fill("1.9");await tab(page,"Layout");await expect(page.getByTestId("zoom-level")).toHaveText("125%");
});
test("source/target MFD, offset, projection update results; rotation and TBD suppress stale values",async({page})=>{
  await example(page,"matching");await choose(page,"waveguide");await page.getByLabel("MFDx",{exact:true}).fill("50");
  await expect(page.getByTestId("summary-eta")).not.toHaveText("100%");
  await page.getByLabel("Y Position",{exact:true}).fill("0.02");
  await page.getByLabel("Roll",{exact:true}).fill("1");await tab(page,"Analysis");await expect(page.getByTestId("solver-status")).toHaveText("out-of-domain");await expect(page.getByTestId("eta")).toHaveText("Not calculated");
  await choose(page,"waveguide");await page.getByLabel("Roll",{exact:true}).fill("0");await page.getByLabel("MFDx",{exact:true}).fill("");await tab(page,"Analysis");await expect(page.getByTestId("calculation-reason")).toContainText("TBD");
  await tab(page,"Layout");await openProjectExample(page,'ideal:matching');await acceptProjectReplacement(page);await choose(page,"fiber");await page.getByLabel("MFDy",{exact:true}).fill("45");
  await tab(page,"Layout");await page.getByRole("button",{name:"X–Z",exact:true}).click();await expect(page.getByTestId("beam-overlay")).toBeVisible();await expect(page.getByTestId("summary-eta")).not.toHaveText("100%");
});
test("invalid numeric drafts restore last valid values on Enter/Blur; auto-applied close persists",async({page})=>{
  await example(page,"matching");await choose(page,"lens-f");const f=page.getByLabel("Focal Length",{exact:true});
  await f.fill("0");await expect(f).toHaveAttribute("aria-invalid","true");await expect(page.getByTestId("eta")).toHaveText("Not calculated");
  await f.press("Enter");await expect(f).toHaveValue("1.25");await expect(page.getByTestId("eta")).toHaveText("100%");
  await f.fill("");await expect(f).toHaveAttribute("aria-invalid","true");await f.press("Tab");await expect(f).toHaveValue("1.25");
  await f.fill("-2.5");await f.press("Enter");await expect(f).toHaveValue("-2.5");
  await f.fill("1.375");await page.getByRole("button",{name:"광학 화면 보기",exact:true}).click();await expect(page.getByTestId("optical-canvas")).toBeVisible();
  expect((await save(page)).components[1].focalLength).toBeCloseTo(0.001375,15);
});
test("visual viewport resize keeps mobile editing exit reachable; JSON roundtrip + Undo/Redo recompute",async({page},info)=>{
  await example(page,"matching");await choose(page,"waveguide");const m=page.getByLabel("MFDx",{exact:true});await m.fill("42.5");
  if(info.project.name==="mobile"){
    await page.evaluate(()=>{const v=window.visualViewport!;Object.defineProperty(v,"height",{configurable:true,value:360});Object.defineProperty(v,"offsetTop",{configurable:true,value:25});v.dispatchEvent(new Event("resize"));});
    const b=await page.getByRole("button",{name:"광학 화면 보기",exact:true}).boundingBox();expect(b!.y).toBeGreaterThanOrEqual(25);expect(b!.y+b!.height).toBeLessThanOrEqual(385);
    await page.getByRole("button",{name:"광학 화면 보기",exact:true}).click();
    await page.evaluate(()=>{const v=window.visualViewport!;delete (v as unknown as Record<string,unknown>).height;delete (v as unknown as Record<string,unknown>).offsetTop;v.dispatchEvent(new Event("resize"));});
  }else await tab(page,"Layout");
  const eta=await page.getByTestId("summary-eta").textContent();const data=await save(page);
  await openProjectExample(page,'ideal:matching');await acceptProjectReplacement(page);await expect(page.getByTestId("summary-eta")).toHaveText("100%");
  await page.getByRole("button",{name:"Undo",exact:true}).click();await expect(page.getByTestId("summary-eta")).toHaveText(eta!);
  await page.getByRole("button",{name:"Redo",exact:true}).click();await expect(page.getByTestId("summary-eta")).toHaveText("100%");
  await page.getByTestId("surface-json-input").setInputFiles({name:"p1.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(data))});await acceptProjectReplacement(page);await expect(page.getByTestId("summary-eta")).toHaveText(eta!);expect(await save(page)).toEqual(data);
});
test("offline file calculation/edit/save/load and responsive evidence",async({page},info)=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));await page.context().setOffline(true);await page.route("**/*",r=>r.request().url().startsWith("file:")?r.continue():r.abort());
  await page.goto(pathToFileURL(resolve("dist/index.html")).href+"#ideal");await example(page,"matching");await expect(page.getByTestId("summary-eta")).toHaveText("100%");
  await choose(page,"lens-f");await page.getByLabel("Focal Length",{exact:true}).fill("1.4");await page.getByRole("button",{name:"광학 화면 보기",exact:true}).click();const data=await save(page);
  await openProjectExample(page,'ideal:matching');await acceptProjectReplacement(page);await page.getByTestId("surface-json-input").setInputFiles({name:"offline-p1.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(data))});await acceptProjectReplacement(page);expect(await save(page)).toEqual(data);await expect(page.getByTestId("summary-eta")).not.toHaveText("100%");expect(errors).toEqual([]);
  await openProjectExample(page,'ideal:matching');await acceptProjectReplacement(page);
  if(info.project.name==="desktop")for(const width of [360,412,768,1366,1920]){await page.setViewportSize({width,height:width<1000?915:900});await page.evaluate(()=>document.fonts.ready);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/P1.1-${width}.png`,fullPage:true});}
  else await page.screenshot({path:"test-results/P1.1-mobile.png",fullPage:true});
});
