/**
 * Which Gemini errors are worth another attempt, and where.
 *
 * Every post-call pass — summary, groundedness, sentiment — walks
 * TEXT_MODEL_FALLBACKS × GEMINI_API_KEYS. A quota error moves to the next key;
 * an overloaded model moves to the next model; anything else stops. Getting
 * this wrong left every call unscored ("0 / cold") for as long as
 * gemini-3.5-flash answered 503, with gemini-3-flash-preview working fine two
 * entries down the list. The messages below are the ones the SDK actually
 * returned that day.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOverloadError, isQuotaError } from "../src/lib/config";

const OVERLOADED =
  'got status: 503 Service Unavailable. {"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}}';
const QUOTA =
  'got status: 429 Too Many Requests. {"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details.","status":"RESOURCE_EXHAUSTED"}}';
const BAD_REQUEST =
  'got status: 400 Bad Request. {"error":{"code":400,"message":"Invalid JSON payload received.","status":"INVALID_ARGUMENT"}}';
const NOT_FOUND =
  'got status: 404 Not Found. {"error":{"code":404,"message":"models/gemini-2.5-flash is no longer available to new users.","status":"NOT_FOUND"}}';

describe("model fallback classification", () => {
  it("treats an overloaded model as worth trying the next model", () => {
    assert.equal(isOverloadError(OVERLOADED), true);
    assert.equal(isOverloadError("The model is overloaded. Please try again later."), true);
  });

  it("does not mistake an overload for quota, or quota for an overload", () => {
    // They move in different directions: quota → next key, overload → next model.
    assert.equal(isQuotaError(OVERLOADED), false);
    assert.equal(isOverloadError(QUOTA), false);
    assert.equal(isQuotaError(QUOTA), true);
  });

  it("stops on errors that would repeat identically", () => {
    for (const message of [BAD_REQUEST, NOT_FOUND]) {
      assert.equal(isOverloadError(message), false, message);
      assert.equal(isQuotaError(message), false, message);
    }
  });

  it("moves on from a model that is too slow to answer", () => {
    // Our own per-attempt timeout aborts the fetch; the gateway can also give up.
    assert.equal(isOverloadError("This operation was aborted"), true);
    assert.equal(isOverloadError('got status: 504 Gateway Timeout. {"error":{"status":"DEADLINE_EXCEEDED"}}'), true);
    assert.equal(isQuotaError("This operation was aborted"), false);
  });

  it("does not read 503 out of a longer number", () => {
    // A transcript id or an amount in the message must not look like a status.
    assert.equal(isOverloadError("call_15035 failed: invalid response"), false);
  });
});
