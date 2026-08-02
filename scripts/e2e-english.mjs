/**
 * English-mode conversation test.
 *
 * Exists because the Hinglish test passed while English was badly broken: her
 * sentences were shredded into fragments, duplicated, and had stray tokens in
 * them. Asserts the three things that were wrong — no Devanagari when English
 * is selected, no fragmentation, no console errors.
 *
 *   node scripts/e2e-english.mjs
 */
import { chromium } from "playwright-core";
const BASE = process.env.BASE_URL || "http://localhost:3000";
const SCRIPT = [
  "Yes, I'm available.",
  "I'm looking to buy for myself.",
  "I'm looking at Noida, around Sector 150.",
  "A three bedroom, budget about one and a half crore.",
  "What is the possession timeline, and is it RERA registered?",
];
const b = await chromium.launch({ headless: true, args:["--use-fake-ui-for-media-stream","--use-fake-device-for-media-capture","--autoplay-policy=no-user-gesture-required"] });
const ctx = await b.newContext({ permissions:["microphone"] });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", e=>errs.push(e.message)); p.on("console", m=>m.type()==="error"&&errs.push(m.text()));
await p.goto(BASE+"/call",{waitUntil:"networkidle"});
// Select ENGLISH opening language.
await p.getByRole("button", { name: "English", exact: true }).click();
await p.getByRole("button", { name: /start the call/i }).click();
await p.waitForFunction(()=>/priya\s+\d{2}:\d{2}/i.test(document.body.innerText),null,{timeout:45000});
console.log("→ opened in English mode\n");
const input = p.getByPlaceholder(/type instead of speaking/i);
for (const line of SCRIPT) {
  await input.fill(line);
  await p.getByRole("button",{name:"Send",exact:true}).click();
  await p.waitForTimeout(13000);
}
const turns = await p.evaluate(()=>[...document.querySelectorAll("p.border-l-2")].map(e=>({
  who: e.parentElement?.querySelector("span")?.textContent?.trim(),
  lang: [...(e.parentElement?.querySelectorAll("span")||[])].map(s=>s.textContent.trim()).find(t=>/Hindi|Hinglish/.test(t)) || "",
  text: e.textContent.trim(),
})));
console.log("=== TRANSCRIPT (english mode) ===");
const DEV=/[ऀ-ॿ]/;
let devanagari=0, fragments=0;
for (const t of turns) {
  const hasDev = DEV.test(t.text);
  if (hasDev && t.who?.toLowerCase()==="priya") devanagari++;
  if (t.who?.toLowerCase()==="priya" && t.text.length < 25) fragments++;
  console.log(`${hasDev?"⚠DEV ":"     "}${(t.who||"?").padEnd(7)} ${t.lang.padEnd(9)} ${t.text.slice(0,120)}`);
}
console.log(`\nagent turns with Devanagari : ${devanagari}`);
console.log(`agent turns under 25 chars  : ${fragments}  (fragmentation / breaking off)`);
console.log(`console errors              : ${errs.length ? errs.slice(0,3).join(" | ") : "none"}`);
await b.close();
