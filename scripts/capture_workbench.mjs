import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const username = process.env.REAL_SCREENSHOT_USERNAME;
const password = process.env.REAL_SCREENSHOT_PASSWORD;
if (!username || !password) {
  throw new Error("请设置REAL_SCREENSHOT_USERNAME和REAL_SCREENSHOT_PASSWORD");
}

const output = resolve(process.argv[2] || "artifacts/workbench-screenshots");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto("http://127.0.0.1:5173/real-materials-showcase/workbench#dashboard");
await page.getByLabel("账号").fill(username);
await page.getByLabel("密码").fill(password);
await page.getByRole("button", { name: "安全登录" }).click();
await page.getByRole("heading", { name: "科研工作台" }).waitFor();

const pages = [
  ["工作台", "01_workbench_dashboard.png"],
  ["文献处理", "02_literature_inbox.png"],
  ["数据库状态", "03_database_health.png"],
  ["下一批文献", "04_doi_priorities.png"],
];
for (const [label, filename] of pages) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolve(output, filename) });
  if (label === "工作台" || label === "数据库状态") {
    await page.screenshot({ path: resolve(output, filename.replace(".png", "_full.png")), fullPage: true });
  }
}
await browser.close();
console.log(output);
