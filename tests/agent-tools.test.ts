import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { executeAgentTool, mergeRequirements } from "../src/lib/agent-tools";
import { formatInr } from "../src/lib/projects";

const CR = 10_000_000;
const L = 100_000;

type SearchResponse = {
  matchCount: number;
  results: { projectId: string; fitScore: number; whyItFits: string[]; caveats: string[] }[];
};

const search = (args: Record<string, unknown>) => executeAgentTool("search_projects", args).response as SearchResponse;

describe("formatInr", () => {
  it("uses Indian units the way a caller would hear them", () => {
    assert.equal(formatInr(95 * L), "₹95 Lakh");
    assert.equal(formatInr(1 * CR), "₹1 Crore");
    assert.equal(formatInr(1.5 * CR), "₹1.5 Crore");
    assert.equal(formatInr(2.75 * CR), "₹2.75 Crore");
    assert.equal(formatInr(45 * L), "₹45 Lakh");
  });

  it("does not print a bare crore figure in lakh", () => {
    assert.match(formatInr(6.5 * CR), /Crore/);
  });
});

describe("search_projects", () => {
  it("puts the mid-budget Noida project first for a 1.5 Cr 3BHK", () => {
    const r = search({
      budgetMinInr: 1.3 * CR,
      budgetMaxInr: 1.5 * CR,
      locations: ["Sector 150"],
      configurations: ["3BHK"],
      propertyType: "apartment",
    });
    assert.ok(r.matchCount > 0);
    assert.equal(r.results[0].projectId, "skyline-greens");
    assert.ok(r.results[0].whyItFits.length > 0, "should explain why it matched");
  });

  it("switches recommendation when the budget moves up", () => {
    // This is the exact interview scenario: caller raises their budget mid-call
    // and wants ready-to-move. The ranking has to actually change.
    const cheap = search({ budgetMaxInr: 1.5 * CR, locations: ["Noida"], configurations: ["3BHK"] });
    const rich = search({ budgetMinInr: 3 * CR, budgetMaxInr: 5 * CR, locations: ["Noida"], configurations: ["3BHK"] });
    assert.equal(cheap.results[0].projectId, "skyline-greens");
    assert.equal(rich.results[0].projectId, "riverfront-residences");
  });

  it("finds an entry-level apartment for a first-time buyer", () => {
    const r = search({ budgetMaxInr: 60 * L, configurations: ["2BHK"], propertyType: "apartment" });
    // Several projects now sit in this band; the top match must be one of the
    // genuinely entry-level ones, not a premium project scraping the ceiling.
    assert.ok(
      ["sunrise-heights", "urbania", "knowledge-park-residency"].includes(r.results[0].projectId),
      `unexpected top match: ${r.results[0].projectId}`,
    );
    assert.ok(r.results[0].fitScore > 0);
  });

  it("does not let the word 'sector' match every project in NCR", () => {
    // "Sector 150" once matched Sector 143B, Sector 128 and everything else,
    // because the token fallback accepted the bare word "sector".
    const r = search({ locations: ["Sector 150"], configurations: ["3BHK"], budgetMaxInr: 1.5 * CR });
    assert.equal(r.results[0].projectId, "skyline-greens");
    const meadows = r.results.find((x) => x.projectId === "meadows");
    if (meadows) {
      assert.ok(
        meadows.caveats.some((c) => /Sector 150/i.test(c)),
        "Sector 143B should be flagged as a location mismatch for a Sector 150 request",
      );
    }
  });

  it("still matches a location named without a number", () => {
    for (const q of ["Noida Expressway", "Indirapuram", "Greater Noida West", "Knowledge Park"]) {
      const r = search({ locations: [q] });
      assert.ok(r.results[0].fitScore > 0, `"${q}" produced no positive match`);
    }
  });

  it("returns plots when the caller wants land, not flats", () => {
    const r = search({ propertyType: "plot", budgetMaxInr: 1 * CR });
    assert.equal(r.results[0].projectId, "green-acres");
  });

  it("matches on a loose location string the way a caller would say it", () => {
    for (const q of ["Noida Expressway", "sector 150", "150", "noida"]) {
      const r = search({ locations: [q] });
      assert.ok(r.results.length > 0, `no results for "${q}"`);
      assert.ok(r.results[0].fitScore > 0, `"${q}" produced no positive match`);
    }
  });

  it("tolerates a caller who has said nothing concrete yet", () => {
    const r = search({});
    assert.ok(r.results.length > 0);
  });

  it("reports honestly when nothing fits instead of forcing a match", () => {
    // Nothing in the catalogue is a commercial property under 5 lakh.
    const r = search({ propertyType: "commercial", budgetMaxInr: 5 * L });
    assert.equal(r.matchCount, 0);
    assert.ok(r.results.every((x) => x.caveats.length > 0), "every non-match should carry a caveat");
  });

  it("flags a sold-out configuration rather than offering it", () => {
    // 5BHK exists at Riverfront but is marked unavailable.
    const r = search({ configurations: ["5BHK"], budgetMinInr: 5 * CR, budgetMaxInr: 7 * CR });
    const riverfront = r.results.find((x) => x.projectId === "riverfront-residences");
    assert.ok(riverfront, "riverfront should still be considered");
    assert.ok(
      riverfront!.caveats.some((c) => /sold out/i.test(c)),
      `expected a sold-out caveat, got ${JSON.stringify(riverfront!.caveats)}`,
    );
  });
});

describe("update_lead_requirements", () => {
  it("drops empty and 'unknown' values so a vague answer never overwrites a known one", () => {
    const { requirementsPatch } = executeAgentTool("update_lead_requirements", {
      name: "Rahul",
      phone: "",
      intent: "unknown",
      preferredLocations: [],
      budgetMaxInr: 15_000_000,
    });
    assert.deepEqual(requirementsPatch, { name: "Rahul", budgetMaxInr: 15_000_000 });
  });
});

describe("mergeRequirements", () => {
  it("lets a later answer overwrite an earlier one", () => {
    const merged = mergeRequirements({ budgetMaxInr: 1.5 * CR }, { budgetMaxInr: 2.5 * CR });
    assert.equal(merged.budgetMaxInr, 2.5 * CR);
  });

  it("never lets undefined clear a value already captured", () => {
    const merged = mergeRequirements({ name: "Rahul", phone: "9810012345" }, { name: undefined, phone: "" });
    assert.equal(merged.name, "Rahul");
    assert.equal(merged.phone, "9810012345");
  });

  it("unions list fields, because callers name several sectors across a call", () => {
    const merged = mergeRequirements(
      { preferredLocations: ["Sector 150"] },
      { preferredLocations: ["Sector 128", "Sector 150"] },
    );
    assert.deepEqual(merged.preferredLocations?.sort(), ["Sector 128", "Sector 150"]);
  });
});

describe("get_project_details", () => {
  it("returns the full sheet for a known project", () => {
    const r = executeAgentTool("get_project_details", { projectId: "skyline-greens" }).response as Record<string, unknown>;
    assert.equal(r.name, "Aarambh Skyline Greens");
    assert.ok(Array.isArray(r.amenities));
    assert.ok(String(r.reraNote).length > 0, "RERA placeholder must be disclosed to the model");
  });

  it("refuses to invent a project it does not have", () => {
    const r = executeAgentTool("get_project_details", { projectId: "does-not-exist" }).response as Record<string, unknown>;
    assert.ok(r.error);
    assert.ok(Array.isArray(r.validIds));
  });
});

describe("schedule_site_visit", () => {
  it("records the visit and marks it simulated", () => {
    const r = executeAgentTool("schedule_site_visit", {
      projectId: "skyline-greens",
      name: "Rahul Verma",
      phone: "9810012345",
      preferredTime: "Saturday morning",
    });
    assert.equal((r.response as Record<string, unknown>).simulated, true);
    assert.equal(r.requirementsPatch?.siteVisitRequested, true);
    assert.equal(r.requirementsPatch?.siteVisitPreference, "Saturday morning");
  });
});

describe("end_call", () => {
  it("signals the transport to tear down and carries the outcome", () => {
    const r = executeAgentTool("end_call", { outcome: "site_visit_booked", reason: "Booked for Saturday" });
    assert.equal(r.endCall?.outcome, "site_visit_booked");
  });
});

describe("unknown tools", () => {
  it("returns an error rather than throwing and killing the call", () => {
    const r = executeAgentTool("definitely_not_a_tool", {});
    assert.ok((r.response as Record<string, unknown>).error);
  });
});
