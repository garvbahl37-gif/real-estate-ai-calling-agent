/** Renders demo/title.html to demo/title.png at 1920x1080, with real webfonts. */
import { chromium } from "playwright-core";

const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await p.goto(`file://${process.cwd()}/demo/title.html`, { waitUntil: "networkidle" });
await p.waitForTimeout(1200); // let the webfonts settle before capturing
await p.screenshot({ path: "demo/title.png" });
await b.close();
console.log("demo/title.png");
