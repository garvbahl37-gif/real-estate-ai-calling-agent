/**
 * Runs the adversarial persona suite against the live agent and scores it.
 *
 *   pnpm eval                    # every persona
 *   pnpm eval -- pure-english    # one or more by id
 *   EVAL_CONCURRENCY=2 pnpm eval
 *
 * Writes evals/runs/<timestamp>.json and prints a table. Compare runs across a
 * prompt change to see whether an improvement in one dimension cost another —
 * which is exactly what happened when tightening the noise handling made the
 * agent slower.
 */
import "./load-env.mts";

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { PERSONAS } from "../src/lib/eval/personas";
import { evaluatePersona } from "../src/lib/eval/runner";
import { aggregate, type EvalRun } from "../src/lib/eval/types";
import { LIVE_MODEL } from "../src/lib/config";

const wanted = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const personas = wanted.length ? PERSONAS.filter((p) => wanted.includes(p.id)) : PERSONAS;
if (!personas.length) {
  console.error(`No matching personas. Available:\n${PERSONAS.map((p) => "  " + p.id).join("\n")}`);
  process.exit(1);
}

// Each persona holds a Live session plus several text calls. Free-tier quota is
// the binding constraint, not CPU, so keep this low.
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY || 2);

const startedAt = new Date().toISOString();
console.log(`Evaluating ${personas.length} persona(s) against ${LIVE_MODEL}, ${CONCURRENCY} at a time\n`);

const results: Awaited<ReturnType<typeof evaluatePersona>>[] = [];
const queue = [...personas];

async function worker() {
  for (;;) {
    const persona = queue.shift();
    if (!persona) return;
    const t0 = Date.now();
    try {
      const r = await evaluatePersona(persona);
      results.push(r);
      const flag = r.error ? "ERROR" : r.overall >= 4 ? "  ok " : r.overall >= 3 ? " warn" : " FAIL";
      console.log(
        `[${flag}] ${persona.id.padEnd(26)} ${r.error ? r.error.slice(0, 40) : `${r.overall.toFixed(2)}/5`}` +
          `  ${r.turnCount} turns  ${((Date.now() - t0) / 1000).toFixed(0)}s`,
      );
    } catch (err) {
      console.log(`[ERROR] ${persona.id.padEnd(26)} ${(err as Error).message.slice(0, 50)}`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const scored = results.filter((r) => !r.error && r.scores.length);
const allExpectations = results.flatMap((r) => r.expectations);
const grounded = results.map((r) => r.groundedness?.score).filter((s): s is number => typeof s === "number");

let gitSha: string | undefined;
try {
  gitSha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
} catch {
  /* not a git checkout */
}

const run: EvalRun = {
  id: startedAt.replace(/[:.]/g, "-"),
  startedAt,
  finishedAt: new Date().toISOString(),
  model: LIVE_MODEL,
  gitSha,
  results: results.sort((a, b) => a.personaId.localeCompare(b.personaId)),
  meanScore: scored.length ? Number((scored.reduce((n, r) => n + r.overall, 0) / scored.length).toFixed(2)) : 0,
  expectationPassRate: allExpectations.length
    ? Number((allExpectations.filter((e) => e.met).length / allExpectations.length).toFixed(3))
    : 0,
  meanGroundedness: grounded.length ? Math.round(grounded.reduce((a, b) => a + b, 0) / grounded.length) : undefined,
};

mkdirSync("evals/runs", { recursive: true });
const file = `evals/runs/${run.id}.json`;
writeFileSync(file, JSON.stringify(run, null, 2));
writeFileSync("evals/latest.json", JSON.stringify(run, null, 2));

console.log("\n" + "─".repeat(62));
console.log(`overall            ${run.meanScore.toFixed(2)} / 5`);
console.log(`expectations met   ${(run.expectationPassRate * 100).toFixed(0)}%`);
if (run.meanGroundedness !== undefined) console.log(`groundedness       ${run.meanGroundedness}/100`);
console.log("─".repeat(62));
for (const row of aggregate(run)) {
  const bar = "█".repeat(Math.round(row.mean)) + "·".repeat(5 - Math.round(row.mean));
  console.log(`${row.label.padEnd(26)} ${bar}  ${row.mean.toFixed(2)}   worst: ${row.worst.personaId}`);
}
console.log("─".repeat(62));

const failures = allExpectations.filter((e) => !e.met);
if (failures.length) {
  console.log(`\n${failures.length} unmet expectation(s):`);
  for (const f of failures.slice(0, 12)) console.log(`  ✗ ${f.expectation}\n      ${f.evidence.slice(0, 110)}`);
}
console.log(`\n→ ${file}`);
process.exit(0);
