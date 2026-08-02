# Demo script

Read this from a phone or a second window so the recording shows a clean app.

**Before you start:** quiet room; System Settings → Sound → Output **MacBook Pro Speakers**,
Input **MacBook Pro Microphone**. Or keep headphones and just use the app's own
**Download recording (.wav)** button afterwards — it captures both voices regardless.

---

### 1. Do this — _The agent opens the call herself, unprompted_


**Watch:** Say nothing. She greets you first — this is an outbound sales call, not a chatbot waiting for input.

### 2. Hindi — _Understands spoken Hindi_

> ## हाँ जी बोलिए
>
> Haan ji boliye

### 3. Hindi — _Hindi comprehension + requirement capture_

> ## मुझे नोएडा में 3BHK चाहिए, investment के लिए देख रहा हूँ
>
> Mujhe Noida mein 3BHK chahiye, investment ke liye dekh raha hoon

**Watch:** LEAD RECORD — intent, location and configuration land while she is still speaking.

### 4. Hinglish — _Hinglish, and Indian number formats (डेढ़ करोड़ = 1.5 Cr)_

> ## Budget around डेढ़ करोड़ तक रखा है
>
> Budget around dedh crore tak rakha hai

**Watch:** BUDGET fills in as ₹1.5 Crore — it parsed a spoken Hindi quantity into rupees.

### 5. Do this — _Barge-in: she stops within milliseconds_

> ## — interrupt her mid-sentence —

**Watch:** Talk over her while she is pitching. She stops mid-word and answers you. Say anything: “ek minute”.

### 6. Hinglish — _Answers project questions from the catalogue, not from imagination_

> ## Possession कब तक है? और RERA registered है क्या?
>
> Possession kab tak hai? Aur RERA registered hai kya?

**Watch:** TOOL CALLS — get_project_details fires. She quotes December 2027 because that is what the data says.

### 7. English — _Switches to English mid-call without being asked_

> ## What are the amenities there?

### 8. Hinglish — _Handles a changed requirement — the interviewer will ask for exactly this_

> ## Actually budget बढ़ा के 2.5 crore कर देते हैं, और ready to move चाहिए
>
> Actually budget badha ke 2.5 crore kar dete hain, aur ready to move chahiye

**Watch:** She re-runs search_projects and switches from Skyline Greens to Riverfront Residences. BUDGET overwrites to ₹2.5 Cr — it does not append.

### 9. Hinglish — _Objection handling — and honesty about a budget that does not fit_

> ## Sector 128 थोड़ा महँगा नहीं है? 3.2 crore से शुरू हो रहा है
>
> Sector 128 thoda mehenga nahi hai? 3.2 crore se shuru ho raha hai

**Watch:** She does not pretend it fits. She says so and asks whether you can stretch.

### 10. Hindi — _Contact capture, including a spoken phone number_

> ## ठीक है। मेरा नाम राहुल वर्मा है, नंबर 98100 12345
>
> Theek hai. Mera naam Rahul Verma hai, number 98100 12345

**Watch:** NAME and PHONE land in the lead record. She reads the number back to confirm.

### 11. Hinglish — _Books the next step and closes the call herself_

> ## हाँ site visit कर लेते हैं, Saturday morning
>
> Haan site visit kar lete hain, Saturday morning

**Watch:** schedule_site_visit fires, then end_call — she hangs up rather than talking forever.

### 12. Do this — _Post-call summary and lead scoring_


**Watch:** Wait for CALL SUMMARY. Headline, qualification score, the objection you raised, and the next action. Then open /leads to show it persisted.
