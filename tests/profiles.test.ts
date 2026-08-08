/**
 * Agent profiles, and specifically whether they are real.
 *
 * A profile that changes the greeting but leaves the tools searching the whole
 * catalogue is decoration: the tools are what she reads her answers from, so
 * she would still quote another desk's inventory the moment a caller asked.
 * These tests exist to hold that line — every route into the catalogue has to
 * respect the scope, including the ones a caller could reach by naming a
 * project id directly.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSystemInstruction } from "../src/lib/agent-prompt";
import { agentFunctionDeclarations, executeAgentTool } from "../src/lib/agent-tools";
import { PROJECTS, operatingMarkets, scopedProjects } from "../src/lib/projects";
import { PROFILES, getProfile, profileProjectIds } from "../src/lib/profiles";

const commercial = getProfile("rohan-commercial");
const scope = { projectIds: commercial.projectIds };

type SearchResponse = { results: { projectId: string }[] };
const search = (args: Record<string, unknown>) =>
  executeAgentTool("search_projects", args, scope).response as SearchResponse;

describe("profile definitions", () => {
  it("gives every profile a distinct id", () => {
    assert.equal(new Set(PROFILES.map((p) => p.id)).size, PROFILES.length);
  });

  it("falls back to the default for an unknown id", () => {
    assert.equal(getProfile("does-not-exist").id, PROFILES[0].id);
    assert.equal(getProfile(undefined).id, PROFILES[0].id);
  });

  it("only ever references projects that exist", () => {
    const known = new Set(PROJECTS.map((p) => p.id));
    for (const p of PROFILES) {
      for (const id of p.projectIds) assert.ok(known.has(id), `${p.id} references missing project ${id}`);
    }
  });

  it("degrades a broken project list to the full catalogue, not to nothing", () => {
    // Selling everything is visibly wrong in a demo; selling nothing looks like
    // the agent is broken and is far harder to diagnose from a transcript.
    const broken = { ...commercial, projectIds: ["no-such-project"] };
    assert.equal(profileProjectIds(broken).length, PROJECTS.length);
  });
});

describe("catalogue scoping", () => {
  it("narrows the catalogue to the profile's list", () => {
    const scoped = scopedProjects(commercial.projectIds);
    assert.ok(scoped.length > 0);
    assert.ok(scoped.length < PROJECTS.length, "the commercial desk should not see everything");
    assert.ok(
      scoped.every((p) => p.propertyType === "commercial" || p.propertyType === "plot"),
      "an apartment leaked into the commercial desk's catalogue",
    );
  });

  it("derives the markets she may claim from the same list she can sell", () => {
    // Otherwise a desk restricted to Noida could still tell a caller the
    // developer operates on the Yamuna Expressway.
    const scopedMarkets = operatingMarkets(commercial.projectIds);
    const cities = new Set(scopedProjects(commercial.projectIds).map((p) => p.city));
    assert.deepEqual(new Set(scopedMarkets), cities);
  });
});

describe("tool scoping", () => {
  it("never returns an out-of-scope project from a search", () => {
    const allowed = new Set(commercial.projectIds);
    for (const args of [
      { propertyType: "apartment", budgetMaxInr: 200_000_000 },
      { locations: ["Noida"], budgetMaxInr: 200_000_000 },
      { configuration: "3BHK" },
      {},
    ]) {
      // Searches fall back to showing the closest options when nothing scores,
      // so this covers the "no match" path too — which is where a leak hides.
      for (const r of search(args).results) {
        assert.ok(allowed.has(r.projectId), `search leaked ${r.projectId} for ${JSON.stringify(args)}`);
      }
    }
  });

  it("refuses a project id the profile is not allowed to sell", () => {
    const forbidden = PROJECTS.find((p) => !commercial.projectIds.includes(p.id))!;
    const res = executeAgentTool("get_project_details", { projectId: forbidden.id }, scope).response as {
      error?: string;
      name?: string;
      validIds?: string[];
    };
    assert.ok(res.error, `read out ${forbidden.name}, which this desk cannot sell`);
    assert.equal(res.name, undefined);
    assert.ok(!res.validIds?.includes(forbidden.id));
  });

  it("still serves a project the profile does own", () => {
    const own = commercial.projectIds[0];
    const res = executeAgentTool("get_project_details", { projectId: own }, scope).response as { name?: string };
    assert.ok(res.name, "the profile's own inventory should be readable");
  });

  it("leaves an unscoped call seeing the whole catalogue", () => {
    const res = executeAgentTool("get_project_details", { projectId: PROJECTS[0].id }).response as { name?: string };
    assert.ok(res.name);
  });
});

describe("tool declarations", () => {
  it("advertises only the project ids the profile can actually use", () => {
    const allowed = new Set(commercial.projectIds);
    const enums = agentFunctionDeclarations(scope)
      .flatMap((d) => Object.values(d.parameters?.properties ?? {}))
      .map((sch) => (sch as { enum?: string[] }).enum)
      .filter((e): e is string[] => Array.isArray(e));

    const projectEnums = enums.filter((e) => e.some((v) => allowed.has(v)));
    assert.ok(projectEnums.length > 0, "no project-id enum found to check");
    for (const e of projectEnums) {
      for (const id of e) assert.ok(allowed.has(id), `declaration offered ${id}, outside this profile`);
    }
  });

  it("leaves non-project enums alone", () => {
    // propertyType, purpose and the like are shared vocabulary, not inventory.
    const scoped = agentFunctionDeclarations(scope);
    const full = agentFunctionDeclarations();
    assert.equal(scoped.length, full.length);
    const types = (ds: ReturnType<typeof agentFunctionDeclarations>) =>
      ds.flatMap((d) => Object.values(d.parameters?.properties ?? {}))
        .map((s) => (s as { enum?: string[] }).enum)
        .filter((e): e is string[] => Array.isArray(e) && e.includes("apartment"));
    assert.deepEqual(types(scoped), types(full));
  });

  it("returns the untouched declarations when nothing is scoped", () => {
    assert.equal(agentFunctionDeclarations(), agentFunctionDeclarations());
  });
});

describe("system instruction", () => {
  it("introduces her as the profile, not as the default", () => {
    const prompt = buildSystemInstruction({ profile: commercial });
    assert.match(prompt, /You are Rohan/);
    assert.doesNotMatch(prompt, /You are Priya/);
  });

  it("includes the persona note when there is one", () => {
    assert.match(buildSystemInstruction({ profile: commercial }), /commercial and land desk/);
  });

  it("lists only the projects the profile may sell", () => {
    const prompt = buildSystemInstruction({ profile: commercial });
    const allowed = new Set(commercial.projectIds);
    for (const p of PROJECTS) {
      if (allowed.has(p.id)) continue;
      assert.ok(!prompt.includes(`[${p.id}]`), `prompt offered ${p.name}, outside this profile`);
    }
  });

  it("opens in the profile's language unless the call overrides it", () => {
    assert.match(buildSystemInstruction({ profile: getProfile("meera-hindi") }), /Open the call in Hindi/);
    assert.match(
      buildSystemInstruction({ profile: getProfile("meera-hindi"), openingLanguage: "english" }),
      /Open the call in Indian English/,
    );
  });

  it("still builds a complete prompt with no profile at all", () => {
    const prompt = buildSystemInstruction();
    assert.match(prompt, /You are Priya/);
    assert.ok(prompt.length > 5000, "default prompt lost content");
  });
});
