import { expect, test } from "@playwright/test";

test("dashboard exposes the three core modes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Was möchtest du heute lernen?" })).toBeVisible();
    await expect(page.locator(".demo-pill:visible").first()).toBeVisible();
  await expect(page.getByText("Etwas verstehen", { exact: true })).toBeVisible();
  await expect(page.getByText("Klausur korrigieren", { exact: true })).toBeVisible();
  await expect(page.getByText("Gemeinsam lernen", { exact: true })).toBeVisible();
});

test("creates a transparent structured demo explanation", async ({ page }) => {
  await page.goto("/lernen?mode=explanation");
  await page.getByRole("button", { name: "Wie prüfe ich die Rücknahme nach § 48 VwVfG?" }).click();
  await page.getByRole("button", { name: "Absenden" }).click();
  await expect(page.getByText("Demoantwort", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Juristisch präzise" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Verwendete Quellen" })).toBeVisible();
});

test("correction always shows a clearly labelled grade estimate", async ({ page }) => {
  await page.goto("/lernen?mode=correction&prompt=Korrigiere%20meine%20Lösung");
  await page.getByRole("button", { name: "Absenden" }).click();
  await expect(page.getByText("Deutlich gekennzeichnete Notenschätzung")).toBeVisible();
  await expect(page.getByText("Unverbindliche KI-Schätzung – keine offizielle Klausurbewertung")).toBeVisible();
});
