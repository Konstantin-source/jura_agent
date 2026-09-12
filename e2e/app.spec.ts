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
  await page.goto("/lernen?mode=explanation&subject=Schuldrecht%20II");
  const prompt = page.getByRole("textbox");
  const modelSelect = page.getByRole("combobox", { name: "Modellstärke" });
  await expect(modelSelect).toHaveValue("normal");
  await expect(modelSelect.locator("option")).toHaveCount(4);
  await modelSelect.selectOption("advanced");
  await page.getByRole("button", { name: "Erkläre mir Schadensersatz aus § 280 Abs. 1 BGB." }).click();
  await page.getByRole("button", { name: "Absenden" }).click();
  await expect(prompt).toHaveValue("");
  await expect(page.getByText("Demoantwort", { exact: true })).toBeVisible();
  await expect(page.locator(".user-message")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Genauer" })).toBeVisible();
  await expect(page.locator(".formatted-numbered-list li")).toHaveCount(4);
  await expect(page.getByRole("heading", { name: "Verwendete Quellen" })).toBeVisible();

  await prompt.fill("Warum ist der Vertrauensschutz dabei wichtig?");
  await page.getByRole("button", { name: "Absenden" }).click();
  await expect(prompt).toHaveValue("");
  await expect(page.locator(".user-message")).toHaveCount(2);
  await expect(page.locator(".assistant-answer")).toHaveCount(2);
  await expect(page.getByText("Warum ist der Vertrauensschutz dabei wichtig?", { exact: true })).toBeVisible();

  await page.goto("/chats");
  await page.getByRole("button", { name: /Erkläre mir Schadensersatz/ }).click();
  await expect(page.locator(".user-message")).toHaveCount(2);
  await expect(page.locator(".assistant-answer")).toHaveCount(2);
});

test("correction always shows a clearly labelled grade estimate", async ({ page }) => {
  await page.goto("/lernen?mode=correction&prompt=Korrigiere%20meine%20Lösung");
  await page.getByRole("button", { name: "Absenden" }).click();
  await expect(page.getByText("Deutlich gekennzeichnete Notenschätzung")).toBeVisible();
  await expect(page.getByText("Unverbindliche KI-Schätzung – keine offizielle Klausurbewertung")).toBeVisible();
});
