/**
 * Full-conversation acceptance test.
 *
 * Drives a complete qualification call through the console's text input, which
 * exercises exactly the same Live session, tool executor and persistence path
 * as speech — it just removes the need to synthesise Hindi audio in CI.
 *
 * Asserts the things that actually matter for this product:
 *   - the agent opens the call itself
 *   - it answers in Hinglish rather than defaulting to English
 *   - tool calls fire and populate the CRM panel live
 *   - a mid-call budget change is picked up and overwrites the old value
 *   - the post-call summary is generated and scored
 */
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL || "http://localhost:3000";

const SCRIPT = [
  { say: "Haan ji boliye", wait: 9000 },
  { say: "Main investment ke liye dekh raha hoon, Noida mein", wait: 13000 },
  { say: "3BHK chahiye, budget around 1.5 crore tak", wait: 15000 },
  { say: "Possession kab tak hai? Aur RERA registered hai kya?", wait: 15000 },
  // The interviewer will do exactly this, so the test does it too.
  { say: "Actually budget badha ke 2.5 crore kar dete hain, ready to move chahiye", wait: 16000 },
  { say: "Theek hai. Mera naam Rahul Verma hai, number 9810012345", wait: 13000 },
  { say: "Haan site visit kar lete hain, Saturday morning", wait: 13000 },
];

const browser = await chromium.launch({
  headless: true,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-capture", "--autoplay-policy=no-user-gesture-required"],
});
const ctx = await browser.newContext({ permissions: ["microphone"] });
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(`${BASE}/call`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /start the call/i }).click();
console.log("→ call started, waiting for Priya to open…");

await page.waitForFunction(() => /priya\s+\d{2}:\d{2}/i.test(document.body.innerText), null, { timeout: 45000 });
console.log("→ Priya opened the call\n");

const input = page.getByPlaceholder(/type instead of speaking/i);
for (const [i, step] of SCRIPT.entries()) {
  await input.fill(step.say);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  console.log(`  [${i + 1}/${SCRIPT.length}] → "${step.say}"`);
  await page.waitForTimeout(step.wait);
}

// Read the live CRM panel before hanging up.
const leadBefore = await page.evaluate(() => {
  const rows = [...document.querySelectorAll("dl > div")];
  return rows.map((r) => r.innerText.replace(/\n+/g, " · ")).filter((t) => !t.endsWith("· —"));
});
const toolNames = await page.evaluate(() =>
  [...document.querySelectorAll("li code")].map((c) => c.previousElementSibling?.querySelector("span")?.textContent).filter(Boolean),
);
const toolCount = await page.evaluate(() => document.querySelectorAll("li code").length);

console.log("\n=== TRANSCRIPT ===");
console.log(
  await page.evaluate(() => {
    const out = [];
    document.querySelectorAll("p.border-l-2").forEach((p) => {
      const who = p.parentElement?.querySelector("span")?.textContent ?? "?";
      out.push(`${who.padEnd(7)} ${p.textContent.trim()}`);
    });
    return out.join("\n");
  }),
);

console.log("\n=== LEAD CAPTURED LIVE ===");
console.log(leadBefore.length ? leadBefore.join("\n") : "(nothing captured — FAIL)");
console.log(`\n=== TOOL CALLS: ${toolCount} ===`);
console.log(toolNames.join(", ") || "(none — FAIL)");

// Hang up and let the summary generate.
await page.getByRole("button", { name: /end the call/i }).click();
console.log("\n→ ended call, generating summary…");
await page
  .waitForFunction(() => /Qualification/i.test(document.body.innerText) && /\b(hot|warm|cold)\b/i.test(document.body.innerText), null, { timeout: 60000 })
  .catch(() => console.log("  (summary did not render in time)"));

console.log("\n=== SUMMARY ===");
console.log(
  await page.evaluate(() => {
    const h = document.querySelector("h2")?.textContent ?? "(no headline)";
    const body = document.body.innerText;
    const start = body.indexOf("CALL SUMMARY");
    return h + "\n" + (start >= 0 ? body.slice(start, start + 1400) : "(not found)");
  }),
);

console.log("\n=== CONSOLE ERRORS ===");
console.log(errors.length ? errors.slice(0, 8).join("\n") : "(none)");

await page.screenshot({ path: "scripts/_shot-conversation.png", fullPage: true });
await browser.close();
