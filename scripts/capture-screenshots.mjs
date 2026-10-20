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

/**
 * Chrome's fake microphone plays a continuous tone, and the model hears it as a
 * caller talking — the transcript filled with invented Hindi. The caller's side
 * of the scripted call is typed, so the page gets a microphone that is
 * digitally silent instead. (--use-file-for-fake-audio-capture is ignored by
 * the headless shell.)
 */
function silentMicrophone() {
  const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    if (!constraints?.audio) return real(constraints);
    const ac = new AudioContext();
    const osc = ac.createOscillator();
    const mute = ac.createGain();
    mute.gain.value = 0;
    const out = ac.createMediaStreamDestination();
    osc.connect(mute).connect(out);
    osc.start();
    return out.stream;
  };
}
// Reduced motion: the landing page opens with a ~3 s splash and plays its hero
// in over several seconds. With motion reduced it renders the finished state,
// so a shot taken on load shows the page, not a frame of the intro.
const ctx = await b.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  permissions: ["microphone"],
  reducedMotion: "reduce",
});

/** `at`: text to scroll to first, so a shot can show a section below the hero. */
async function shot(path, name, { full = false, wait = 700, at } = {}) {
  const p = await ctx.newPage();
  await p.goto(BASE + path, { waitUntil: "networkidle" });
  if (at) {
    await p.getByText(at, { exact: false }).first().scrollIntoViewIfNeeded();
    await p.evaluate(() => window.scrollBy(0, -140));
  }
  await p.waitForTimeout(wait);
  await p.screenshot({ path: `${DIR}/${name}.png`, fullPage: full });
  console.log("  ", name);
  await p.close();
}

await shot("/", "01-landing");
await shot("/call", "02-call-setup");
await shot("/projects", "05-projects-ladder", { at: "Why ₹1.5 Cr and ₹2.5 Cr", wait: 1200 });
await shot("/projects/skyline-greens", "06-project-detail");
await shot("/how-it-works", "07-architecture");
await shot("/ops", "10-ops");

// One real call, captured mid-conversation and again at the summary.
const p = await ctx.newPage();
await p.addInitScript(silentMicrophone);
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
// Typing into the input scrolls it into view, which clips the header.
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(300);
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
