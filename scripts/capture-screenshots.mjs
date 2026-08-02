/**
 * Captures the screenshots embedded in the README.
 *
 * The live-call and summary shots need a real conversation, so one call is
 * driven through the text input — same session, tools and persistence as speech.
 *
 *   node scripts/capture-screenshots.mjs
 */
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const DIR = "docs/screenshots";
const b = await chromium.launch({
  headless: true,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-capture", "--autoplay-policy=no-user-gesture-required"],
});
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, permissions: ["microphone"] });

async function shot(path, name, { full = false, wait = 700 } = {}) {
  const p = await ctx.newPage();
  await p.goto(BASE + path, { waitUntil: "networkidle" });
  await p.waitForTimeout(wait);
  await p.screenshot({ path: `${DIR}/${name}.png`, fullPage: full });
  console.log("  ", name);
  await p.close();
}

await shot("/", "01-landing");
await shot("/call", "02-call-setup");
await shot("/projects", "05-projects-ladder");
await shot("/projects/skyline-greens", "06-project-detail");
await shot("/how-it-works", "07-architecture");

// One real call, captured mid-conversation and again at the summary.
const p = await ctx.newPage();
await p.goto(BASE + "/call", { waitUntil: "networkidle" });
await p.getByRole("button", { name: /start the call/i }).click();
await p.waitForFunction(() => /priya\s+\d{2}:\d{2}/i.test(document.body.innerText), null, { timeout: 45000 });
const input = p.getByPlaceholder(/type instead of speaking/i);
for (const line of [
  "Haan ji boliye",
  "Main investment ke liye dekh raha hoon, Noida mein",
  "3BHK chahiye, budget around 1.5 crore tak",
  "Possession kab tak hai? Aur RERA registered hai kya?",
]) {
  await input.fill(line);
  await p.getByRole("button", { name: "Send", exact: true }).click();
  await p.waitForTimeout(12000);
}
await p.screenshot({ path: `${DIR}/03-live-call.png` });
console.log("   03-live-call");

await input.fill("Theek hai. Mera naam Rahul Verma hai, number 9810012345. Saturday morning site visit kar lete hain.");
await p.getByRole("button", { name: "Send", exact: true }).click();
await p.waitForTimeout(15000);
const end = p.getByRole("button", { name: /end the call/i });
if (await end.count()) await end.click().catch(() => {});
await p.waitForFunction(() => /\b(hot|warm|cold)\b/i.test(document.body.innerText), null, { timeout: 60000 }).catch(() => {});
await p.waitForTimeout(1500);
await p.screenshot({ path: `${DIR}/04-call-summary.png`, fullPage: true });
console.log("   04-call-summary");
await p.close();

await shot("/leads", "08-leads");
const leads = await ctx.newPage();
await leads.goto(BASE + "/leads", { waitUntil: "networkidle" });
const first = leads.locator('a[href^="/leads/"]').first();
if (await first.count()) {
  await first.click();
  await leads.waitForLoadState("networkidle");
  await leads.waitForTimeout(800);
  await leads.screenshot({ path: `${DIR}/09-lead-detail.png`, fullPage: true });
  console.log("   09-lead-detail");
}
await leads.close();
await b.close();
