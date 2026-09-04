import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const baseURL = process.env.SCREENSHOT_BASE_URL ?? "http://127.0.0.1:3000";
const outputDirectory = new URL("../docs/screenshots/", import.meta.url);

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: executablePath ? ["--no-sandbox", "--disable-setuid-sandbox"] : [],
});

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
  const desktopPage = await desktop.newPage();
  await desktopPage.goto(baseURL, { waitUntil: "networkidle" });
  await desktopPage.screenshot({ path: new URL("dashboard-desktop.png", outputDirectory).pathname, fullPage: true });
  await desktop.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(`${baseURL}/lernen?mode=correction&prompt=Korrigiere%20meine%20Lösung`, {
    waitUntil: "networkidle",
  });
  await mobilePage.getByRole("button", { name: "Absenden" }).click();
  await mobilePage.getByText("Deutlich gekennzeichnete Notenschätzung").waitFor();
  await mobilePage.screenshot({ path: new URL("correction-mobile.png", outputDirectory).pathname, fullPage: false });
  await mobile.close();
} finally {
  await browser.close();
}
