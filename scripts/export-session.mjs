/**
 * Exports a Claude Code session transcript for sharing, with credentials removed.
 *
 *   node scripts/export-session.mjs <session.jsonl> [out.jsonl]
 *
 * A raw transcript is a verbatim log of everything typed into the conversation.
 * For this project that includes five Gemini API keys, a Twilio Account SID,
 * API key SID, API key secret and Auth Token, a personal mobile number, and any
 * Postgres connection string that appeared in a command or an env dump. None of
 * that is obvious from looking at the file, because it is 18 MB of JSON and the
 * secrets are scattered through it as ordinary message text.
 *
 * Redaction here is by *shape*, not by a list of known values. A denylist only
 * catches the secrets you remembered, and the ones you forgot are exactly the
 * ones that leak — the same lesson the app's own phone-number redaction learned
 * three times over.
 *
 * Nothing is removed silently: every replacement is counted and reported, and
 * the original file is never modified.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [, , input, output] = process.argv;
if (!input) {
  console.error("usage: node scripts/export-session.mjs <session.jsonl> [out.jsonl]");
  process.exit(1);
}
const outPath = output ?? input.replace(/\.jsonl$/, "") + ".redacted.jsonl";

/**
 * Ordered most-specific first. Each entry is a credential *shape*; the label is
 * what appears in the placeholder so a reader of the export can see what was
 * removed rather than finding an unexplained blank.
 */
const RULES = [
  // Google OAuth-style API keys (the AQ. form AI Studio issues).
  { label: "GEMINI_API_KEY", re: /\bAQ\.[A-Za-z0-9_-]{20,}/g },
  // Classic Google API keys.
  { label: "GOOGLE_API_KEY", re: /\bAIza[A-Za-z0-9_-]{35}/g },
  // Twilio: Account SID, API Key SID, and the 32-hex Auth Token.
  { label: "TWILIO_ACCOUNT_SID", re: /\bAC[0-9a-fA-F]{32}\b/g },
  { label: "TWILIO_API_KEY_SID", re: /\bSK[0-9a-fA-F]{32}\b/g },
  { label: "TWILIO_AUTH_TOKEN", re: /(?<![0-9a-fA-F])[0-9a-fA-F]{32}(?![0-9a-fA-F])/g },
  // Database and other connection strings, including the password segment.
  { label: "DATABASE_URL", re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|rediss):\/\/[^\s"'\\`<>]+/gi },
  // Bearer tokens and generic secret assignments in shell/env text.
  { label: "BEARER_TOKEN", re: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/g },
  {
    label: "SECRET",
    re: /\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|APIKEY|API_KEY)[A-Z0-9_]*)\s*[=:]\s*["']?([^\s"'\\`,}]{8,})/g,
    replace: (_m, key) => `${key}=«redacted:SECRET»`,
  },
  // Indian mobile numbers, in E.164 or bare form.
  { label: "PHONE", re: /(?:\+91[\s-]?)?(?<!\d)[6-9]\d{9}(?!\d)/g },
];

const raw = readFileSync(input, "utf8");
let out = raw;
const counts = new Map();

for (const rule of RULES) {
  out = out.replace(rule.re, (...args) => {
    counts.set(rule.label, (counts.get(rule.label) ?? 0) + 1);
    return rule.replace ? rule.replace(...args) : `«redacted:${rule.label}»`;
  });
}

// Every line must still parse — a share that cannot be opened is not a share.
let bad = 0;
for (const line of out.split("\n")) {
  if (!line.trim()) continue;
  try {
    JSON.parse(line);
  } catch {
    bad++;
  }
}

writeFileSync(outPath, out);

const total = [...counts.values()].reduce((a, b) => a + b, 0);
console.log(`\n  in   ${input}  (${(raw.length / 1e6).toFixed(1)} MB)`);
console.log(`  out  ${outPath}  (${(out.length / 1e6).toFixed(1)} MB)\n`);
if (total === 0) {
  console.log("  Nothing matched. Check the file is the transcript you meant.\n");
} else {
  for (const [label, n] of [...counts].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${label}`);
  }
  console.log(`  ${String(total).padStart(5)}  total replacements\n`);
}
console.log(
  bad === 0
    ? "  Every line still parses as JSON.\n"
    : `  WARNING: ${bad} line(s) no longer parse — do not share this file.\n`,
);
console.log("  Redaction is by shape, so it can still miss a secret in an unusual form.");
console.log("  Rotating the credentials is the only thing that actually makes them safe.\n");
