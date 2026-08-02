/**
 * End-to-end smoke test for the browser voice demo.
 *
 * Chromium is launched with a fake capture device so getUserMedia resolves
 * without a real microphone. That is enough to prove the whole chain: worklets
 * load under CSP, the ephemeral token is minted, the WebSocket to Google opens,
 * the agent speaks first, transcription streams back, and tool calls fire.
 */
import { chromium } from "playwright-core";

const CHROME = process.env.CHROME_PATH;
const BASE = process.env.BASE_URL || "http://localhost:3000";

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream",     // auto-accept the mic prompt
    "--use-fake-device-for-media-capture", // synthesise a mic
    "--autoplay-policy=no-user-gesture-required",
  ],
});
const ctx = await browser.newContext({ permissions: ["microphone"] });
const page = await ctx.newPage();

const errors = [];
const logs = [];
page.on("console", (m) => {
  const t = `${m.type()}: ${m.text()}`;
  logs.push(t);
  if (m.type() === "error") errors.push(t);
});
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

await page.goto(`${BASE}/call`, { waitUntil: "networkidle" });
console.log("→ /call loaded");

await page.getByRole("button", { name: /start the call/i }).click();
console.log("→ clicked Start the call");

// Wait for the agent to actually say something.
const deadline = Date.now() + 45000;
let transcript = "";
let state = "";
while (Date.now() < deadline) {
  state = (await page.locator('[role="status"]').first().textContent().catch(() => "")) ?? "";
  transcript = (await page.locator("main").innerText().catch(() => "")) ?? "";
  // Look for a real agent turn: the "Priya" byline followed by a timestamp.
  if (/priya\s+\d{2}:\d{2}/i.test(transcript)) break;
  await page.waitForTimeout(700);
}

console.log("\n=== STATE ===\n" + state);

// Pull the visible connection log from the page itself.
await page.locator("details summary").click().catch(() => {});
await page.waitForTimeout(300);
await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
await page.waitForTimeout(200);
const detailsText = await page.locator("details pre").innerText().catch(() => "(no log)");
console.log("\n=== CONNECTION LOG ===\n" + (detailsText || "(not expanded)"));

const body = await page.locator("main").innerText();
console.log("\n=== VISIBLE TRANSCRIPT AREA ===");
console.log(body.split("\n").filter(Boolean).slice(0, 40).join("\n"));

console.log("\n=== CONSOLE ERRORS ===");
console.log(errors.length ? errors.slice(0, 12).join("\n") : "(none)");

await page.screenshot({ path: "scripts/_shot-call.png", fullPage: true });
console.log("\nscreenshot -> scripts/_shot-call.png");

await browser.close();
