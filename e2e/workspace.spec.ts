import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { exampleDocument } from "../src/domain";
import type { Page } from "@playwright/test";

async function mobileTab(page: Page, name: string) {
  if (
    await page.getByRole("navigation", { name: "Workspace tabs" }).isVisible()
  )
    await page
      .getByRole("navigation", { name: "Workspace tabs" })
      .getByRole("button", { name, exact: true })
      .click();
}
async function choose(page: Page, id: string) {
  await mobileTab(page, "Train");
  await page.getByTestId(`tree-${id}`).click();
}
async function save(page: Page) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save JSON" }).click();
  const download = await downloadPromise;
  return JSON.parse(await readFile((await download.path())!, "utf8"));
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
test("initial layout has honest analysis, terminal ports and no horizontal overflow", async ({
  page,
}) => {
  await expect(page.getByTestId("optical-canvas")).toBeVisible();
  const fiber = await page.getByTestId("layout-fiber").boundingBox(),
    wg = await page.getByTestId("layout-waveguide").boundingBox();
  expect(fiber!.x).toBeLessThan(wg!.x);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await mobileTab(page, "Analysis");
  await expect(page.getByText("Not calculated", { exact: true })).toHaveCount(
    3,
  );
  await choose(page, "fiber");
  await expect(
    page.getByRole("button", { name: "Delete Component" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Move Component down" }),
  ).toBeDisabled();
  await expect(page.getByLabel("MFDx", { exact: true })).toHaveValue("");
});
test("repeated property edits retain the same SVG and element nodes", async ({
  page,
}) => {
  await choose(page, "lens-f");
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    w.initialCanvas = document.querySelector('[data-testid="optical-canvas"]');
    w.initialLens = document.querySelector('[data-testid="layout-lens-f"]');
  });
  for (let i = 0; i < 12; i++) {
    await page
      .getByRole("spinbutton", { name: "X Position", exact: true })
      .fill(String(3 + i * 0.1));
  }
  expect(
    await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      return (
        w.initialCanvas ===
          document.querySelector('[data-testid="optical-canvas"]') &&
        w.initialLens ===
          document.querySelector('[data-testid="layout-lens-f"]')
      );
    }),
  ).toBe(true);
  await expect(
    page.getByRole("spinbutton", { name: "X Position", exact: true }),
  ).toHaveValue("4.1");
  await mobileTab(page, "Layout");
  await expect(page.getByTestId("layout-lens-f")).toContainText("Lens F");
});
test("shared XY and XZ coordinates, orientation and MFD survive save", async ({
  page,
}) => {
  await choose(page, "waveguide");
  await page
    .getByRole("spinbutton", { name: "Y Position", exact: true })
    .fill(".2");
  await page
    .getByRole("spinbutton", { name: "Z Position", exact: true })
    .fill(".3");
  await page.getByLabel("MFDx", { exact: true }).fill("3.2");
  await page.getByLabel("MFDy", { exact: true }).fill("2.1");
  await page.getByLabel("Yaw", { exact: true }).fill("12");
  await mobileTab(page, "Layout");
  await expect(page.getByTestId("layout-waveguide")).toContainText(
    "MFDx 3.2 µm",
  );
  await page.getByRole("button", { name: "X–Z", exact: true }).click();
  await expect(page.getByTestId("layout-waveguide")).toContainText(
    "MFDy 2.1 µm",
  );
  const data = await save(page),
    wg = data.components.at(-1);
  expect(wg.frame.origin.y).toBeCloseTo(0.0002);
  expect(wg.frame.origin.z).toBeCloseTo(0.0003);
  expect(wg.mode.mfdX).toBeCloseTo(0.0000032);
  expect(wg.mode.mfdY).toBeCloseTo(0.0000021);
  expect(wg.frame.rotation.yaw).toBeCloseTo(Math.PI / 15);
});
test("add, reorder, disable, remove, undo and redo", async ({ page }) => {
  await mobileTab(page, "Train");
  await page.getByLabel("Component type").selectOption("lens");
  await page.getByRole("button", { name: "Add Component" }).click();
  await expect(page.getByLabel("Component Name", { exact: true })).toHaveValue(
    "Thin Lens",
  );
  await page
    .getByRole("spinbutton", { name: "X Position", exact: true })
    .fill("7");
  await page.getByRole("button", { name: "Move Component up" }).click();
  let saved = await save(page);
  expect(saved.components.at(-3).name).toBe("Thin Lens");
  expect(saved.components.at(-3).frame.origin.x).toBe(0.007);
  await page.getByLabel("Enabled", { exact: true }).uncheck();
  saved = await save(page);
  expect(
    saved.components.find((c: { name: string }) => c.name === "Thin Lens")
      .enabled,
  ).toBe(false);
  await page.getByRole("button", { name: "Delete Component" }).click();
  expect((await save(page)).components).toHaveLength(6);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await save(page)).components).toHaveLength(7);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect((await save(page)).components).toHaveLength(6);
});
test("JSON round-trip and bad imports preserve the design", async ({
  page,
}) => {
  await choose(page, "waveguide");
  await page.getByLabel("MFDx", { exact: true }).fill("3.8");
  const data = await save(page);
  await page
    .getByRole("button", { name: "1310 nm Example", exact: true })
    .click();
  await page.getByTestId("json-input").setInputFiles({
    name: "saved.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data)),
  });
  expect(await save(page)).toEqual(data);
  await page.getByTestId("json-input").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{bad"),
  });
  await expect(page.getByRole("alert")).toContainText("기존");
  expect(await save(page)).toEqual(data);
  const future = { ...data, schemaVersion: 99 };
  await page.getByTestId("json-input").setInputFiles({
    name: "future.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(future)),
  });
  await expect(page.getByRole("alert")).toContainText("기존");
  expect(await save(page)).toEqual(data);
});
test("validation blocks invalid geometry; lock blocks editing", async ({
  page,
}) => {
  await choose(page, "lens-f");
  await page.getByLabel("X Position", { exact: true }).fill("20");
  await expect(page.getByRole("alert")).toContainText("Port 사이");
  expect((await save(page)).components[1].frame.origin.x).toBe(0.003);
  await page.getByLabel("X Position", { exact: true }).fill("3.5");
  await page
    .getByRole("button", { name: "Lock Component", exact: true })
    .click();
  await expect(page.getByLabel("X Position", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Delete Component" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Unlock Component", exact: true })
    .click();
  await expect(page.getByLabel("X Position", { exact: true })).toBeEnabled();
});
test("projection, zoom and fit are usable", async ({ page }) => {
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.getByTestId("zoom-level")).toHaveText("125%");
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect(page.getByTestId("zoom-level")).toHaveText("100%");
  await page.getByRole("button", { name: "X–Z", exact: true }).click();
  await expect(page.getByTestId("optical-canvas")).toHaveAttribute(
    "aria-label",
    "XZ Optical Train schematic",
  );
  await page.getByRole("button", { name: "Fit to system" }).click();
});
test("layout and data editor select and edit the same component", async ({
  page,
}, info) => {
  test.skip(
    info.project.name === "mobile",
    "Mobile uses canvas-first Train/Edit tabs.",
  );
  await page
    .getByRole("button", { name: "Select Lens S in Layout", exact: true })
    .click();
  await expect(page.getByLabel("Component Name", { exact: true })).toHaveValue(
    "Lens S",
  );
  await page.getByLabel("Lens S Y table", { exact: true }).fill(".5");
  await expect(page.getByLabel("Y Position", { exact: true })).toHaveValue(
    "0.5",
  );
});
test("offline single HTML works with networking disabled and no runtime errors", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (route) =>
    route.request().url().startsWith("file:")
      ? route.continue()
      : route.abort(),
  );
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(resolve("dist/index.html")).href);
  await expect(page.getByTestId("optical-canvas")).toBeVisible();
  await choose(page, "waveguide");
  await page.getByLabel("MFDx", { exact: true }).fill("4");
  const data = await save(page);
  expect(data.components.at(-1).mode.mfdX).toBeCloseTo(0.000004);
  await page.getByTestId("json-input").setInputFiles({
    name: "offline.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exampleDocument())),
  });
  await expect(page.getByRole("status")).toContainText("offline.json");
  expect(errors).toEqual([]);
  await mobileTab(page, "Layout");
  await page.screenshot({
    path: `test-results/P0-${info.project.name}.png`,
    fullPage: true,
  });
});

test("viewport matrix stays within the screen and keeps the canvas available", async ({
  page,
}, info) => {
  test.skip(
    info.project.name === "mobile",
    "Viewport matrix runs once on desktop context.",
  );
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 360, height: 800 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await page.getByTestId("optical-canvas").waitFor({ state: "visible" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${viewport.width}px overflow`,
    ).toBe(true);
    await page.evaluate(() => document.fonts.ready);
    if ([360, 1366].includes(viewport.width))
      await page.screenshot({
        path: `test-results/P0-${viewport.width}.png`,
        fullPage: true,
      });
  }
});

test("pan changes the camera; fit restores it; flags and wavelength are persisted", async ({
  page,
}) => {
  const before = await page
    .getByTestId("layout-lens-s")
    .locator("circle")
    .getAttribute("cx");
  const canvas = await page.getByTestId("optical-canvas").boundingBox();
  await page.mouse.move(canvas!.x + 30, canvas!.y + 60);
  await page.mouse.down();
  await page.mouse.move(canvas!.x + 60, canvas!.y + 75);
  await page.mouse.up();
  const after = await page
    .getByTestId("layout-lens-s")
    .locator("circle")
    .getAttribute("cx");
  expect(Number(after) - Number(before)).toBeCloseTo(30);
  await page.getByRole("button", { name: "Fit to system" }).click();
  expect(
    await page
      .getByTestId("layout-lens-s")
      .locator("circle")
      .getAttribute("cx"),
  ).toBe(before);
  await choose(page, "lens-f");
  await page.getByLabel("X Variable", { exact: true }).check();
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await page.getByLabel("Vacuum Wavelength", { exact: true }).fill("1550");
  await page.getByRole("button", { name: "Close Help" }).click();
  const data = await save(page);
  expect(data.wavelength).toBeCloseTo(0.00000155);
  expect(data.components[1].variables).toEqual(["x"]);
});
