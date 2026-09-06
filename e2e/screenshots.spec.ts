import { expect, test } from "@playwright/test";

test("capture desktop dashboard", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop artifact only");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Was möchtest du heute lernen?" })).toBeVisible();
  await expect(page.locator(".demo-pill:visible").first()).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/dashboard-desktop.png", fullPage: true });
});

test("capture mobile correction", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile artifact only");
  await page.goto("/lernen?mode=correction&prompt=Korrigiere%20meine%20Lösung");
  await expect(page.locator(".demo-pill:visible").first()).toBeVisible();
  await page.getByRole("button", { name: "Absenden" }).click();
  await expect(page.getByText("Deutlich gekennzeichnete Notenschätzung")).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/correction-mobile.png", fullPage: false });
});
