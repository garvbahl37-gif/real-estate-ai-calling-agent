# Building a live Hindi/Hinglish real-estate voice agent

### A Claude Code session, from an empty directory to production

This is the working record of one agent session: an assignment brief pasted in on 2 August,
a deployed and audited product by 9 August. 31 commits, 12,400 lines of TypeScript, 137 tests,
live at **[real-estate-ai-calling-agent.vercel.app](https://real-estate-ai-calling-agent.vercel.app)**.

The build itself is the ordinary part. The reason I kept this session is what happened at the end,
when the instruction was *"check workflow end to end audit everything in loop full review looks scan
for bugs vulnerabiltiese"* — and the agent went looking for defects in code it had written itself,
an hour earlier, and found five. Every one of them was silent. Nothing threw, nothing logged, and
each would have demoed perfectly.

---

## The session in numbers

| | |
|---|---|
| Span | 2 – 9 August |
| Substantive prompts | 29 |
| Tool calls | 682 (439 shell, 91 file writes, 76 edits) |
| Commits | 31 |
| Source | ~12,400 lines TypeScript / TSX |
| Tests | 137, across 9 files |
| Eval score | 4.57 / 5 across 9 adversarial personas |
| Layout audit | 21/21 clean (7 pages × 3 breakpoints, against production) |
| Credentials found in this transcript | 356 — see the note at the bottom |

---

## What it is

A voice agent that qualifies real-estate buyers over a live call in Hindi, Hinglish and English,
switching mid-sentence when the caller does. Built on the Gemini Live API's native speech-to-speech
model — no ASR → LLM → TTS chain — with two transports over one identical agent definition: a
browser demo and a Twilio Media Streams phone bridge.

She runs a real qualification flow through seven tools, matches against a 15-project catalogue,
handles interruption with true barge-in, and writes a scored lead into Postgres. Around that:
telemetry, an eval harness, a factual-accuracy checker, an outbound campaign engine, agent
profiles, post-call delivery providers, and an operations dashboard.

---

## The part worth reading

Told to audit its own work, the agent found five bugs. They are worth listing individually because
of *what kind* of bugs they are — none is a crash, and none would fail a demo.

### 1. A PII exposure chain

The campaign list endpoint was public and returned campaign ids. The campaign *detail* endpoint took
an id and returned the uploaded contacts. Chained, that was one unauthenticated request away from
dumping a bulk marketing list of third-party mobile numbers.

Verified live before and after — the exploit was replayed against the running server, returned real
phone numbers, and now returns `401`.

The follow-on was the more interesting half. Masking the phone *fields* wasn't enough:

> the caller reads their number out loud, so it also sits verbatim in the transcript, in the
> arguments of the tool call that captured it, and in the model-written summary prose

The number was found in **three separate rounds**, in three different places — and a fourth time on
the production sweep, inside a generated `.ics` calendar payload that the redaction didn't cover.
Final state: **0 dialable numbers across six production surfaces**, operator access unaffected,
transcripts still readable.

### 2. The accuracy checker could be walked past

The agent has a groundedness checker: it extracts every factual claim she made on a call and
verifies each against the catalogue in code. It reported 100/100 on real calls, which proves
nothing. So it was fed a call where the agent lies five times — a ₹75 Lakh 3BHK, a possession date
20 months early, an invented rooftop casino, a false claim to have verified the RERA registration,
and an offer of a sold-out unit.

**It caught two.**

The extractor was receiving only *her* turns, on the reasonable-sounding logic that hers are the
only ones being checked. But real answers are elliptical. The caller asks *"Skyline Greens ka 3BHK
kitne ka hai?"*, and two turns later she says *"possession March 2026 mein ho jayega"* without
naming the project again. Stripped of the question, there is nothing to attribute the claim to — so
it came back unattributed, and an unattributed claim can only be marked *unverifiable*, which is
**excluded from the score** rather than counted against it.

The net effect: the agent could fabricate freely so long as she never repeated the project name.

The second miss was subtler. The RERA over-claim rule matched English past tense — `verified`,
`checked`. She says it in Hinglish: *"Maine RERA registration khud verify kiya hai"*, where the verb
is the bare English stem carrying a Hindi auxiliary. The pattern went straight past it.

Both fixed. 5/5 now.

### 3. Campaigns closed themselves with work outstanding

A contact awaiting a retry sits in `no_answer` with a future timestamp — neither `queued` nor
`calling`. The completion check looked at only those two, so the first tick after a no-answer found
nothing to claim, concluded everything was settled, and marked the campaign complete. Completed
campaigns are then dropped by the dispatcher, so the retry never fired.

Not an error. Just a lead quietly never called again.

### 4. The eval harness was scoring the agent for its own mistake

The harness hardcoded a Hinglish opening for every persona. But the agent speaks first, before the
caller has said anything, so she cannot mirror a language she has not heard — in the product that
setting comes from the caller's own selection. The English-only and Hindi-only personas were
therefore greeted in Hinglish and then marked down for it. **All four failed expectations in that
run traced back to the harness, not the agent.**

Separately, three personas displayed `0.00/5` when the *judge* ran out of quota — indistinguishable
from an agent that failed catastrophically. An unjudged run now says so rather than reporting a zero.

### 5. A latent UTF-8 bug in the calendar exporter

RFC 5545 folds lines at 75 **octets**. The content is UTF-8, and this catalogue is full of ₹ and
Devanagari, so an octet-boundary split would cut a character in half and emit a replacement
character on unfold. It hadn't fired yet — the test content happened not to straddle a boundary.

---

## Six decisions, and the reasoning

The thing I want to point at here isn't the conclusions — it's that each one has a stated *why*,
and several overturn the obvious first answer.

**Similarity thresholds cannot gate geography.** Semantic search over the catalogue looked like a
tuning problem. It isn't. Measured across a probe set, relevant queries bottom out at `0.590` and
off-topic ones top out at `0.540` — but *"office space in Bangalore Koramangala"* scores **0.628**,
above every genuinely relevant query, because a Noida commercial project really is about office
space and the only wrong thing is the city. A city is not a semantic property. No threshold,
absolute or z-scored, separates these. Geography is now gated deterministically and the floor only
catches true off-topic: 15/15 on the probe set, against 12/15 before.

**The tool executor stayed pure.** One tool needed the network, and the obvious move — make the
executor async — would have spread a promise, and its latency, through every transport. A
round-trip inside a tool call is *audible on a voice call as a stall*. Instead the executor stayed
synchronous and testable without mocks, and a thin `runAgentTool` wrapper dispatches the one
networked tool. The async boundary exists in exactly one place.

**The contact table is a queue, not a record store.** Claiming uses `SELECT … FOR UPDATE SKIP
LOCKED`, because two dispatcher ticks overlapping is routine on Vercel — a cron firing while the
previous tick is still placing calls — and without it both read the same rows and both dial them.
A separate reclaim returns contacts leaked by a function that died mid-tick, which would otherwise
consume a concurrency slot forever.

**TRAI's calling hours are enforced in code, not configuration.** 09:00–21:00 is a regulation, so
the API clamps a configured window to it rather than trusting the request, and retries are scheduled
through the same function — a contact that fails at 20:58 must not get its 45-minute retry at 21:43.
The offset is fixed at +5:30 because India has not observed DST since 1945: Vercel runs UTC, and the
rule is about the person being called.

**Agent profiles scope the tools, not just the greeting.** The tools are what she reads her answers
from, so a profile that changes the name while leaving the executor searching the whole catalogue is
decoration. Scope is threaded into every route into the catalogue, and the markets she claims to
operate in are *derived* from the same list — otherwise a desk restricted to Noida could still tell
a caller the developer operates on the Yamuna Expressway.

**Dialling is off by default, behind two separate switches.** `OPS_ADMIN_TOKEN` decides who may
manage a campaign; `CAMPAIGNS_ENABLED` decides whether a real call may be placed at all. With the
second unset the queue still runs completely — claiming, backing off, respecting the window —
through a placer that dials nothing and *releases* its claim rather than consuming a retry. The
engine is fully observable without anyone's phone ringing. That is how it ships.

---

## How the session was actually driven

The prompts below are verbatim, typos included. They are mostly short, and often quite vague —
*"build all think deeply build all features tier 1 2 and 3 make it really good"*. I've left them
unedited because a cleaned-up version would misrepresent what happened.

That gap is the honest point of interest. The direction was high-level and the judgement was
delegated; what came back included a measured probe set to justify a threshold, a live replay of a
security exploit before and after the fix, and a deliberate attempt to make its own accuracy checker
fail. The session is worth reading for where the agent pushed back on its own first answer, not for
the prompting.

Two habits did most of the work:

- **Naming the failure mode, not the feature.** "Check for bugs" produced tidying. *"Audit
  everything, scan for bugs and vulnerabilities"* produced the exploit chain.
- **Refusing to accept a green result.** A groundedness checker that only ever reports 100/100 is
  not evidence. Feeding it a call with five deliberate lies is.

---

## Full prompt log

Every substantive instruction in the session, in order, verbatim. Credentials are replaced with
`«redacted:…»` placeholders — see the note below.

#### 01 · 2026-08-02 07:47Z

> Hi,
> 
> Assignment: Build a Live Real Estate AI Calling Agent
> 
> As part of the final technical interview round, you are required to build and present a live working AI calling agent for the real estate industry.
> 
> The purpose of this assignment is to evaluate your ability to independently research, learn new tools, integrate different technologies, and deliver a functional AI-based solution.
> 
> What You Need to Build build this fully really advance fully frontend if possible deploy on number then tell have to build this really goood
> 
> Create an AI voice-calling agent that can communicate with a prospective real estate client in:
> 
> * Hindi
> * Hinglish
> * Basic English, whenever required
> 
> The AI agent should behave like a real estate sales executive and have a natural conversation with the customer.
> 
> Minimum Conversation Flow
> 
> The AI agent should be able to:
> 
> 1. Greet the customer and introduce itself as a real estate representative.
> 2. Ask whether the customer is looking to buy or invest in a property.
> 3. Understand basic requirements such as:
>     * Preferred location
>     * Property type
>     * Configuration such as 2 BHK, 3 BHK, 4 BHK, plot or commercial property
>     * Budget range
>     * Purpo
> 
> […brief continues…]

#### 02 · 2026-08-02 09:04Z

> resume

#### 03 · 2026-08-02 11:35Z

> inable to end call chinese text coming fix this should not happen

#### 04 · 2026-08-02 11:55Z

> what u need to set up twilio delte the git hub repo commit again to github only contributor garvbahl37-gif should come my main github and no claude a scontributor make sure of this delete the repo push again

#### 05 · 2026-08-02 11:58Z

> «redacted:TWILIO_ACCOUNT_SID» can i use my own perosnal mobile number if possible

#### 06 · 2026-08-02 12:27Z

> «redacted:TWILIO_AUTH_TOKEN» auth token enable the number i gaveu

#### 07 · 2026-08-02 13:06Z

> «redacted:TWILIO_AUTH_TOKEN» auth token check now please

#### 08 · 2026-08-02 13:09Z

> done all its live whats the issue

#### 09 · 2026-08-02 13:14Z

> this is trial number i have done eveyrthing verified whats the issue then

#### 10 · 2026-08-02 13:17Z

> «redacted:TWILIO_ACCOUNT_SID»

#### 11 · 2026-08-02 13:28Z

> record the video with the tele prompter i ask priya live with the teleprompter record the video do this create it

#### 12 · 2026-08-02 13:36Z

> first record the video either live do ths lets record the video using tele prompter il read out the script

#### 13 · 2026-08-02 13:37Z

> Continue from where you left off.

#### 14 · 2026-08-02 13:38Z

> resume

#### 15 · 2026-08-02 13:41Z

> how to record the teleprompter is on

#### 16 · 2026-08-02 13:46Z

> Thik hai, main number repeat karti hoon — «redacted:PHONE». Sahi hai na? Main aapko details WhatsApp kar deti hoon. Site visit ka plan bane to batayega, main arrange karwa dungi. Thank you for calling Aarambh Realty, have a nice day!this gets break off fix this issue she doesnt seak this line fully

#### 17 · 2026-08-02 14:22Z

> still not coming i selcted microphone of my headphone remove tele prompter from the main app also im recording butnher voice isnt coming in recording

#### 18 · 2026-08-02 14:33Z

> my audio is not getting picked up late fix this can u something like i gave u my recording u fetch priyas response record it alson my converstaion can u do this this will save me a lot of time and efford

#### 19 · 2026-08-02 14:50Z

> «redacted:GEMINI_API_KEY» another gemini api keyadd it a sfallback «redacted:GEMINI_API_KEY» one more key add fallbacks

#### 20 · 2026-08-02 15:21Z

> make the ui more clean hw it works section mor eclean more good make it clean use skills the rest of projects that we added show in fronted really good enhance the ui make it look professional 
> Deepanshi
> Sat 1 Aug, 18:05 (1 day ago)
> to me
> 
> Hi,
> 
> Assignment: Build a Live Real Estate AI Calling Agent
> 
> As part of the final technical interview round, you are required to build and present a live working AI calling agent for the real estate industry.
> 
> The purpose of this assignment is to evaluate your ability to independently research, learn new tools, integrate different technologies, and deliver a functional AI-based solution.
> 
> What You Need to Build
> 
> Create an AI voice-calling agent that can communicate with a prospective real estate client in:
> 
> * Hindi
> * Hinglish
> * Basic English, whenever required
> 
> The AI agent should behave like a real estate sales executive and have a natural conversation with the customer.
> 
> Minimum Conversation Flow
> 
> The AI agent should be able to:
> 
> 1. Greet the customer and introduce itself as a real estate representative.
> 2. Ask whether the customer is looking to buy or invest in a property.
> 3. Understand basic requirements such as:
>     * Preferred location
>     *
> 
> […brief continues…]

#### 21 · 2026-08-02 15:36Z

> in engish there is a bug the voice is switchiing breaking off check the bug please

#### 22 · 2026-08-02 15:43Z

> resume please resolve all bugs

#### 23 · 2026-08-02 16:27Z

> there are tow screen recording in docuemnts can u assemsble them

#### 24 · 2026-08-02 16:36Z

> assemble the latest two recording add aintro title to the video when u assemble

#### 25 · 2026-08-02 16:37Z

> resume

#### 26 · 2026-08-02 16:57Z

> Continue from where you left off.

#### 27 · 2026-08-02 16:57Z

> resume

#### 28 · 2026-08-08 20:11Z

> what more features can we add make it more good ore beautiful advance think like. asenior ai engieer bacekdn engneer to shwo case my abiltiese to build ai agents plan what more features can we add

#### 29 · 2026-08-08 20:14Z

> build all think deeply build all features tier 1 2 and 3 make it really good think like a senior ai architect and engineer

---

## A note on the transcript itself

The raw session file is 18 MB of JSON, and running a shape-based redactor over it found **356
credentials**: 31 Gemini API keys, 44 Twilio Account SIDs, 29 Auth Tokens, 7 API Key SIDs, a
Postgres `DATABASE_URL`, and 189 phone numbers. None of it is visible from looking at the file.

Anyone sharing a coding-agent transcript should assume the same is true of theirs. The exporter used
here is committed at [`scripts/export-session.mjs`](../scripts/export-session.mjs) and redacts by
*shape* rather than by a list of known values — a denylist only catches the secrets you remembered,
and the ones you forgot are exactly the ones that leak. That is the same lesson the application's
own phone-number redaction learned three times over, which is why the script says so in its header.

Redaction reduces exposure; it does not undo it. Anything that was pasted into a transcript should
be rotated, whether or not the copy you share still contains it.

---

**Repository** · <https://github.com/garvbahl37-gif/real-estate-ai-calling-agent>
**Live demo** · <https://real-estate-ai-calling-agent.vercel.app>
**Video** · <https://youtu.be/wra1p1eUkLs>
