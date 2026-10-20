# Priya — a live Hindi/Hinglish voice agent that qualifies real-estate buyers

**Live:** [real-estate-ai-calling-agent.vercel.app](https://real-estate-ai-calling-agent.vercel.app) ·
**Demo:** [3-min video](https://youtu.be/wra1p1eUkLs) ·
**Code:** [github.com/garvbahl37-gif/real-estate-ai-calling-agent](https://github.com/garvbahl37-gif/real-estate-ai-calling-agent)

Built solo in 7 days with Claude Code. 12,400 lines of TypeScript, 137 tests, deployed and audited.

---

## What it does

Answers the phone, and holds a real sales conversation in **Hindi, Hinglish and English** —
switching mid-sentence when the caller does, because that is how people in Delhi NCR actually talk.

It qualifies the buyer the way a good rep does: intent, location, configuration, budget, purpose,
timeline. It answers questions about a 15-project catalogue from real data. It handles being
interrupted. It books a site visit, takes the number down, reads it back, and ends the call.

Then it writes a scored lead into Postgres and delivers it onward.

**Try it:** [/call](https://real-estate-ai-calling-agent.vercel.app/call) — speak Hindi or English,
interrupt her mid-sentence, change your budget halfway through.

---

## Why it sounds like a person

Most voice agents chain speech-to-text → LLM → text-to-speech. Every hop adds latency, and the
result is the flat call-centre cadence everyone hangs up on.

This runs on **Gemini Live's native speech-to-speech** model — audio in, audio out, no transcription
round-trip. Two consequences:

- **Sub-second response.** Median time-to-first-audio is measured, not asserted, on an operations
  dashboard.
- **Real barge-in.** Interrupt her and she stops inside ~3 ms. Playback is a worklet draining a PCM
  queue, so the queue is dropped instantly — with scheduled audio buffers, whatever the audio thread
  already holds keeps playing, which is exactly the "robot talks over you" failure.

One agent definition, two transports: a browser demo and a Twilio Media Streams phone bridge
(8 kHz μ-law, G.711 codec, resampling both ways). Identical prompt, identical tools.

---

## The hard part isn't the voice

A voice agent demos well and fails quietly. It sounds fluent, so you assume it's right — and in
Indian real estate, being wrong about a possession date or a RERA registration is a regulatory
problem, not a typo.

So the interesting engineering is the part that answers *is it actually working?*

**An eval suite.** Twelve adversarial callers, each played by a model that reads the conversation and
reacts — one whose budget is impossible, one who wants a city we don't serve, one who switches
language mid-call, one who just wants a human. Scored by a judge against a seven-dimension rubric.
Currently **4.57/5**.

**A groundedness checker.** Every factual claim she makes is extracted and verified *in code* against
the catalogue — prices within tolerance, possession years, RERA over-claims, sold-out inventory. A
model is good at finding assertions and bad at adjudicating them, so only extraction is delegated.

**Telemetry.** Time-to-first-audio as p50 and p95, tool latency, barge-ins, reconnects. The mean is
the wrong statistic: a p95 of three seconds is a call that felt broken twice.

**A layout audit.** 7 pages × 3 breakpoints, checking overflow, touch targets, labels, console
errors. 21/21 against production.

---

## What happened when I told it to attack its own work

Near the end I stopped adding features and asked for an adversarial audit of everything just built.
It found five bugs. **Every one was silent** — nothing threw, nothing logged, and each would have
demoed perfectly.

**A PII exposure chain.** The public campaign list handed out ids; the detail endpoint then returned
the uploaded contacts. One unauthenticated request from dumping a marketing list of third-party
mobile numbers. Replayed live against the running server before and after the fix.

Masking the phone *fields* turned out to be insufficient — the caller reads their number out loud, so
it also sat in the transcript, in the tool-call arguments, in the model-written summary, and finally
inside a generated calendar invite. It was found in four separate places across four rounds. Final
sweep: **0 dialable numbers across six production surfaces.**

**An accuracy checker that could be walked past.** It reported 100/100 on real calls, which proves
nothing — so I fed it a call where the agent lies five times. It caught two. The extractor was only
seeing *her* turns, so an elliptical answer ("possession March 2026") had no project to attach to,
came back *unverifiable*, and unverifiable is excluded from the score. The agent could fabricate
freely by never repeating the project name. Now 5/5.

**Campaigns closing with work outstanding.** A contact awaiting retry sits in `no_answer` — neither
queued nor calling — so the completion check declared victory, and completed campaigns get dropped by
the dispatcher. Not an error. Just a lead quietly never called again.

**An eval harness scoring the agent for its own mistake.** It forced a Hinglish greeting on the
English-only and Hindi-only personas, then marked them down for it. All four failed expectations
traced back to the harness.

**A latent UTF-8 bug** in the calendar exporter — RFC 5545 folds at 75 *octets*, and this catalogue
is full of ₹ and Devanagari.

That list is the thing I'd want a technical reviewer to look at. Not because the bugs are exotic, but
because finding them required deliberately trying to break work that already looked finished.

---

## Judgement calls worth defending

**No similarity threshold can gate geography.** Semantic search looked like a tuning problem. It
isn't. Relevant queries bottom out at `0.590` and off-topic ones top out at `0.540` — but *"office
space in Bangalore Koramangala"* scores **0.628**, above every genuinely relevant query, because a
Noida commercial project really *is* about office space and the only wrong thing is the city. A city
is not a semantic property. Geography is gated deterministically instead: 15/15 on the probe set,
against 12/15 before.

**The tool executor stayed synchronous.** One tool needed the network. Making the executor async
would have spread a promise, and its latency, through every transport — and a round-trip inside a
tool call is *audible on a call as a stall*. The async boundary lives in exactly one place.

**Compliance is enforced in code, not configuration.** TRAI restricts promotional calls to
09:00–21:00, so the API clamps a configured window rather than trusting it, and retries schedule
through the same function — a call failing at 20:58 must not retry at 21:43.

**Dialling is off by default, behind two independent switches.** The queue runs completely —
claiming, retrying, respecting the window — through a placer that dials nothing and releases its
claim rather than consuming a retry. Fully observable without anyone's phone ringing. That is how it
ships.

---

## How it was built

Seven days, solo, with Claude Code doing the implementation and me directing and verifying.

The direction was deliberately high-level — I described outcomes and constraints, not steps, and
spent my attention on reviewing output and deciding what to attack next. The patterns that produced
the most value:

**Name the failure mode, not the feature.** "Check for bugs" produces tidying. "Audit everything
end-to-end, scan for vulnerabilities" produced the exposure chain.

**Refuse to accept a green result.** A groundedness checker reporting 100/100 is not evidence.
Feeding it a call with five deliberate lies is. Most of the real bugs came from building a test
designed to fail.

**Make it prove things against something running.** Not "is this fixed" but "replay the exploit
against the live server and show me the status code both times." Every claim in this document was
verified that way.

**Force the reasoning into the artifact.** Commit messages and code comments state *why*, including
what was tried and rejected. That's what caught the geography-threshold dead end — the numbers went
into the commit, and they didn't support the approach.

---

## Stack

Gemini Live (`gemini-3.1-flash-live-preview`) · Gemini 3.5 Flash for summarisation ·
Next.js 16 App Router · TypeScript · Tailwind 4 · Web Audio API worklets ·
Twilio Media Streams · Neon Postgres · Vercel

Runs entirely on free tiers.

---

**Garv Bahl** · [github.com/garvbahl37-gif](https://github.com/garvbahl37-gif)
