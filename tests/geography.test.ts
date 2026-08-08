/**
 * The geography gate is the last line of defence against the agent's most
 * embarrassing failure mode — inventing coverage in a city this developer does
 * not sell in. It once offered a Gurgaon project that does not exist.
 *
 * Worth testing precisely because embeddings cannot do this job: "office space
 * in Bangalore Koramangala" scores 0.628 against the Noida industrial park,
 * higher than genuinely relevant queries, since the only wrong thing about it
 * is the city and a city is not a semantic property.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { operatingMarkets, unservedPlaceIn } from "../src/lib/projects";

describe("unservedPlaceIn", () => {
  it("catches the NCR near-misses callers actually name", () => {
    for (const q of [
      "3BHK in Gurgaon on Golf Course Road",
      "kuch Gurugram mein hai kya",
      "something in Dwarka",
      "Faridabad mein plot chahiye",
    ]) {
      assert.ok(unservedPlaceIn(q), `expected a gate for: ${q}`);
    }
  });

  it("catches other metros, states and abroad", () => {
    assert.equal(unservedPlaceIn("beachfront villa in Goa"), "goa");
    assert.equal(unservedPlaceIn("a farmhouse in Punjab"), "punjab");
    assert.equal(unservedPlaceIn("investment property in Dubai"), "dubai");
  });

  it("prefers the longer name so the reply reads correctly", () => {
    assert.equal(unservedPlaceIn("flat in Navi Mumbai"), "navi mumbai");
  });

  it("does not gate the markets the developer actually serves", () => {
    for (const q of [
      "3BHK near the Noida Expressway with a clubhouse",
      "plot on the Yamuna Expressway near the airport",
      "Greater Noida West mein 2BHK",
      "something in Ghaziabad under a crore",
      "somewhere quiet and green for my elderly parents",
    ]) {
      assert.equal(unservedPlaceIn(q), null, `wrongly gated: ${q}`);
    }
  });

  it("treats 'Delhi NCR' as the region, not as Delhi proper", () => {
    // The region label includes Noida, so gating on it would refuse a caller
    // who has asked for exactly what we sell.
    assert.equal(unservedPlaceIn("something good anywhere in Delhi NCR"), null);
    assert.equal(unservedPlaceIn("anywhere in NCR is fine"), null);
    // Delhi on its own is still out of area.
    assert.equal(unservedPlaceIn("a flat in South Delhi"), "delhi");
  });

  it("does not fire on substrings inside other words", () => {
    // "goa" inside "goad", "pune" inside "puneet" — a naive includes() fails these.
    assert.equal(unservedPlaceIn("Puneet is the buyer's name"), null);
    assert.equal(unservedPlaceIn("do not goad the caller"), null);
  });

  it("never lists a served market as unserved", () => {
    for (const city of operatingMarkets()) {
      assert.equal(unservedPlaceIn(`property in ${city}`), null, `${city} is a served market`);
    }
  });
});
