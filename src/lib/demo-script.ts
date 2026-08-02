/**
 * The demo script for the teleprompter.
 *
 * Ordered so that each beat proves a different line on the assignment's
 * evaluation criteria, and so the hardest things to fake — interruption, a
 * mid-call requirement change, an objection — land in the middle where the
 * viewer is already paying attention.
 *
 * `say` is what the presenter reads out. `proves` is the criterion it
 * demonstrates. `watch` is what to point at on screen, which is what turns a
 * recording of someone talking into a recording of a system working.
 */

export interface DemoBeat {
  /** What to say out loud. Empty when the beat is "stay silent and let her talk". */
  say: string;
  /** Roman transliteration shown under Devanagari, so it can be read aloud confidently. */
  roman?: string;
  language: "hindi" | "hinglish" | "english" | "silence";
  proves: string;
  watch?: string;
}

export const DEMO_SCRIPT: DemoBeat[] = [
  {
    say: "",
    language: "silence",
    proves: "The agent opens the call herself, unprompted",
    watch: "Say nothing. She greets you first — this is an outbound sales call, not a chatbot waiting for input.",
  },
  {
    say: "हाँ जी बोलिए",
    roman: "Haan ji boliye",
    language: "hindi",
    proves: "Understands spoken Hindi",
  },
  {
    say: "मुझे नोएडा में 3BHK चाहिए, investment के लिए देख रहा हूँ",
    roman: "Mujhe Noida mein 3BHK chahiye, investment ke liye dekh raha hoon",
    language: "hindi",
    proves: "Hindi comprehension + requirement capture",
    watch: "LEAD RECORD — intent, location and configuration land while she is still speaking.",
  },
  {
    say: "Budget around डेढ़ करोड़ तक रखा है",
    roman: "Budget around dedh crore tak rakha hai",
    language: "hinglish",
    proves: "Hinglish, and Indian number formats (डेढ़ करोड़ = 1.5 Cr)",
    watch: "BUDGET fills in as ₹1.5 Crore — it parsed a spoken Hindi quantity into rupees.",
  },
  {
    say: "— interrupt her mid-sentence —",
    language: "silence",
    proves: "Barge-in: she stops within milliseconds",
    watch: "Talk over her while she is pitching. She stops mid-word and answers you. Say anything: “ek minute”.",
  },
  {
    say: "Possession कब तक है? और RERA registered है क्या?",
    roman: "Possession kab tak hai? Aur RERA registered hai kya?",
    language: "hinglish",
    proves: "Answers project questions from the catalogue, not from imagination",
    watch: "TOOL CALLS — get_project_details fires. She quotes December 2027 because that is what the data says.",
  },
  {
    say: "What are the amenities there?",
    language: "english",
    proves: "Switches to English mid-call without being asked",
  },
  {
    say: "Actually budget बढ़ा के 2.5 crore कर देते हैं, और ready to move चाहिए",
    roman: "Actually budget badha ke 2.5 crore kar dete hain, aur ready to move chahiye",
    language: "hinglish",
    proves: "Handles a changed requirement — the interviewer will ask for exactly this",
    watch: "She re-runs search_projects and switches from Skyline Greens to Riverfront Residences. BUDGET overwrites to ₹2.5 Cr — it does not append.",
  },
  {
    say: "Sector 128 थोड़ा महँगा नहीं है? 3.2 crore से शुरू हो रहा है",
    roman: "Sector 128 thoda mehenga nahi hai? 3.2 crore se shuru ho raha hai",
    language: "hinglish",
    proves: "Objection handling — and honesty about a budget that does not fit",
    watch: "She does not pretend it fits. She says so and asks whether you can stretch.",
  },
  {
    say: "ठीक है। मेरा नाम राहुल वर्मा है, नंबर 98100 12345",
    roman: "Theek hai. Mera naam Rahul Verma hai, number 98100 12345",
    language: "hindi",
    proves: "Contact capture, including a spoken phone number",
    watch: "NAME and PHONE land in the lead record. She reads the number back to confirm.",
  },
  {
    say: "हाँ site visit कर लेते हैं, Saturday morning",
    roman: "Haan site visit kar lete hain, Saturday morning",
    language: "hinglish",
    proves: "Books the next step and closes the call herself",
    watch: "schedule_site_visit fires, then end_call — she hangs up rather than talking forever.",
  },
  {
    say: "",
    language: "silence",
    proves: "Post-call summary and lead scoring",
    watch: "Wait for CALL SUMMARY. Headline, qualification score, the objection you raised, and the next action. Then open /leads to show it persisted.",
  },
];

export const LANGUAGE_LABEL: Record<DemoBeat["language"], string> = {
  hindi: "Hindi",
  hinglish: "Hinglish",
  english: "English",
  silence: "Do this",
};
