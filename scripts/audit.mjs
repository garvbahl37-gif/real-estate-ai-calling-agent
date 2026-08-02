/**
 * Pre-delivery sweep: every page at every breakpoint, checking the things that
 * actually break — horizontal overflow, unlabelled controls, undersized touch
 * targets, heading structure, console errors, and stray rules with no content.
 *
 *   node scripts/audit.mjs [BASE_URL]
 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";
const PAGES = ["/", "/call", "/projects", "/projects/skyline-greens", "/leads", "/how-it-works"];
const VIEWPORTS = [
  { w: 390, h: 844, name: "mobile" },
  { w: 768, h: 1024, name: "tablet" },
  { w: 1440, h: 900, name: "desktop" },
];

const b = await chromium.launch({ headless: true });
let problems = 0;

for (const path of PAGES) {
  for (const v of VIEWPORTS) {
    const p = await b.newPage({ viewport: { width: v.w, height: v.h } });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await p.goto(BASE + path, { waitUntil: "networkidle" });
    await p.waitForTimeout(500);

    const r = await p.evaluate(() => {
      const out = { overflow: false, small: [], unlabelled: [], orphanRules: [], h1: 0, lang: "", noAlt: 0 };
      out.overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
      out.h1 = document.querySelectorAll("h1").length;
      out.lang = document.documentElement.lang;
      document.querySelectorAll("img").forEach((i) => { if (!i.alt) out.noAlt++; });

      document.querySelectorAll("button, a, input, select, textarea").forEach((el) => {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) return;
        const name = (el.textContent || "").trim() || el.getAttribute("aria-label") ||
                     el.getAttribute("title") || el.getAttribute("placeholder");
        if (!name) out.unlabelled.push(el.tagName + "." + el.className.toString().slice(0, 30));
        // Inline links inside prose are exempt from the 44px target rule.
        const inline = el.tagName === "A" && el.closest("p, li, td");
        if (!inline && b.height < 36) out.small.push(`${el.tagName}:${(name || "").slice(0, 20)} ${Math.round(b.height)}px`);
      });

      document.querySelectorAll("div, section, span").forEach((el) => {
        const before = getComputedStyle(el, "::before");
        const rect = el.getBoundingClientRect();
        if (before.content !== "none" && parseFloat(before.height) > 0 &&
            (el.textContent || "").trim() === "" && rect.width > 150) {
          out.orphanRules.push(el.className.toString().slice(0, 40));
        }
      });
      return out;
    });

    const issues = [];
    if (r.overflow) issues.push("H-OVERFLOW");
    if (r.small.length) issues.push(`small(${r.small.length}) ${r.small.slice(0, 2).join(", ")}`);
    if (r.unlabelled.length) issues.push(`unlabelled(${r.unlabelled.length})`);
    if (r.orphanRules.length) issues.push(`orphan-rule(${r.orphanRules.length}) ${r.orphanRules[0]}`);
    if (r.h1 !== 1) issues.push(`h1=${r.h1}`);
    if (!r.lang) issues.push("no-lang");
    if (r.noAlt) issues.push(`img-no-alt(${r.noAlt})`);
    if (errors.length) issues.push(`console(${errors.length}): ${errors[0].slice(0, 50)}`);

    if (issues.length) problems++;
    console.log(`${path.padEnd(28)} ${v.name.padEnd(8)} ${issues.length ? "⚠ " + issues.join("  ") : "ok"}`);
    await p.close();
  }
}
await b.close();
console.log(`\n${problems === 0 ? "clean — no issues" : problems + " page/viewport combinations with issues"}`);
process.exit(problems === 0 ? 0 : 1);
