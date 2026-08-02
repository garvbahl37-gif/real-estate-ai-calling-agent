/**
 * Assembles the demo video: a title card followed by the screen recordings,
 * fitted to a common frame and loudness-matched.
 *
 *   npx tsx scripts/build-demo-video.mts [clip1.mov clip2.mov ...]
 *
 * With no arguments it takes the two most recent "Screen Recording*.mov" from
 * ~/Documents, in the order they were recorded.
 *
 * Two things this handles that a plain concat does not. macOS screen recordings
 * come out at slightly different heights depending on the window, so each clip
 * is fitted inside one frame and padded in the app's paper colour rather than
 * stretched. And separate takes land at very different levels — one peaking at
 * 0 dB against another at -7 dB makes the cut between them jolt — so both are
 * normalised to -16 LUFS.
 *
 * The title card is rendered from demo/title.html by scripts/render-title.mts,
 * so it uses the same fonts and colours as the site itself.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TITLE_SEC = 3.6;
const OUT = join(homedir(), "Documents", "priya-demo.mp4");
const TITLE_PNG = "demo/title.png";

let clips = process.argv.slice(2);
if (!clips.length) {
  const dir = join(homedir(), "Documents");
  clips = readdirSync(dir)
    .filter((f) => f.startsWith("Screen Recording") && f.endsWith(".mov"))
    .map((f) => join(dir, f))
    .sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs)
    .slice(-2);
}
if (clips.length < 1) {
  console.error("No recordings found. Pass paths explicitly.");
  process.exit(1);
}
if (!existsSync(TITLE_PNG)) {
  console.error(`${TITLE_PNG} missing — run: npx tsx scripts/render-title.mts`);
  process.exit(1);
}

console.log("clips, in order:");
clips.forEach((c) => console.log("  ", c.split("/").pop()));

const fit =
  "scale=1920:1080:force_original_aspect_ratio=decrease," +
  "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xFAF9F6,setsar=1,fps=30";

const parts: string[] = [
  `[0:v]scale=1920:1080,setsar=1,fps=30,fade=t=in:st=0:d=0.4,fade=t=out:st=${TITLE_SEC - 0.5}:d=0.5[vt]`,
];
clips.forEach((_, i) => {
  parts.push(`[${i + 1}:v]${fit}[v${i}]`);
  parts.push(`[${i + 1}:a]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a${i}]`);
});
const silenceIdx = clips.length + 1;
const chain = `[vt][${silenceIdx}:a]` + clips.map((_, i) => `[v${i}][a${i}]`).join("");
parts.push(`${chain}concat=n=${clips.length + 1}:v=1:a=1[v][a]`);

execFileSync(
  "ffmpeg",
  [
    "-y", "-hide_banner", "-loglevel", "error",
    "-loop", "1", "-t", String(TITLE_SEC), "-i", TITLE_PNG,
    ...clips.flatMap((c) => ["-i", c]),
    "-f", "lavfi", "-t", String(TITLE_SEC), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
    "-filter_complex", parts.join(";"),
    "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-c:a", "aac", "-b:a", "192k",
    OUT,
  ],
  { stdio: "inherit" },
);
console.log("\n→", OUT);
