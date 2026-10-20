import { PROJECTS } from "@/lib/projects";
import { PROJECT_COORDS } from "@/lib/presentation";

/**
 * A dot map of the corridor Priya sells in — Ghaziabad, Noida, Greater Noida
 * and the Yamuna Expressway — after the CRM reference's hex-dot world map.
 *
 * The outline is hand-traced and approximate; the point is where buyers are
 * looking, not surveying. Mid-blue dots are projects, cobalt clusters are leads.
 */

const W = 420;
const LNG0 = 77.27;
const LAT0 = 28.715;
const KX = W / 0.37;
// Longitude degrees are ~0.88 the length of latitude degrees at 28.5°N.
const KY = KX / 0.88;
const H = Math.round((LAT0 - 28.28) * KY);

function xy([lat, lng]: [number, number]): [number, number] {
  return [(lng - LNG0) * KX, (LAT0 - lat) * KY];
}

/** Ghaziabad down to the Yamuna Expressway, the river forming the western edge. */
const REGION: [number, number][] = (
  [
    [28.7, 77.33],
    [28.705, 77.42],
    [28.69, 77.5],
    [28.64, 77.54],
    [28.58, 77.56],
    [28.52, 77.59],
    [28.46, 77.6],
    [28.4, 77.61],
    [28.34, 77.625],
    [28.295, 77.61],
    [28.29, 77.56],
    [28.32, 77.52],
    [28.37, 77.49],
    [28.42, 77.46],
    [28.47, 77.42],
    [28.51, 77.37],
    [28.545, 77.32],
    [28.575, 77.3],
    [28.62, 77.3],
    [28.66, 77.31],
  ] as [number, number][]
).map(xy);

const RIVER = (
  [
    [28.705, 77.292],
    [28.64, 77.288],
    [28.575, 77.288],
    [28.54, 77.308],
    [28.5, 77.36],
    [28.46, 77.41],
    [28.41, 77.45],
    [28.36, 77.48],
    [28.3, 77.53],
  ] as [number, number][]
).map(xy);

function inside([x, y]: [number, number], poly: [number, number][]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

const STEP = 9;
// Computed once per server process: the grid never changes.
const DOTS: [number, number][] = [];
for (let row = 0; row * STEP * 0.866 < H; row++) {
  const y = row * STEP * 0.866 + 4;
  for (let x = (row % 2 ? STEP / 2 : 0) + 4; x < W; x += STEP) {
    if (inside([x, y], REGION)) DOTS.push([x, y]);
  }
}

const LABELS = [
  { t: "Ghaziabad", at: [28.684, 77.445] as [number, number] },
  { t: "Noida", at: [28.6, 77.33] as [number, number] },
  { t: "Greater Noida West", at: [28.625, 77.462] as [number, number] },
  { t: "Greater Noida", at: [28.49, 77.535] as [number, number] },
  { t: "Yamuna Expressway", at: [28.305, 77.575] as [number, number] },
];

export interface MapPin {
  at: [number, number];
  count: number;
}

export function LeadMap({ pins, className }: { pins: MapPin[]; className?: string }) {
  const leadPts = pins.map((p) => ({ xy: xy(p.at), count: p.count }));
  const projectPts = PROJECTS.map((p) => PROJECT_COORDS[p.id]).filter(Boolean).map(xy);
  const max = Math.max(1, ...pins.map((p) => p.count));
  const top = [...leadPts].sort((a, b) => b.count - a.count).slice(0, 3);

  const tone = ([x, y]: [number, number]) => {
    for (const l of leadPts) {
      const d = Math.hypot(x - l.xy[0], y - l.xy[1]);
      const r = 12 + 16 * (l.count / max);
      if (d < r * 0.55) return "#325ced";
      if (d < r) return "#6f97f2";
    }
    for (const p of projectPts) {
      if (Math.hypot(x - p[0], y - p[1]) < 9) return "#8bb7f0";
    }
    return "#e3eaf7";
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label="Map of where leads are looking, across Noida, Greater Noida and Ghaziabad">
      <defs>
        <radialGradient id="map-fade" cx="50%" cy="50%" r="65%">
          <stop offset="70%" stopColor="#fff" stopOpacity="0" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.9" />
        </radialGradient>
      </defs>

      <polyline
        points={RIVER.map((p) => p.join(",")).join(" ")}
        fill="none"
        stroke="#d8e6fb"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x={RIVER[5][0] - 4}
        y={RIVER[5][1] + 18}
        transform={`rotate(-42 ${RIVER[5][0] - 4} ${RIVER[5][1] + 18})`}
        fontSize="9"
        fill="#8bb7f0"
        fontWeight="600"
        letterSpacing="2"
      >
        YAMUNA
      </text>

      {/* One path per colour — "M x y h0" with a round cap is a dot. Two
          thousand <circle>s made this the heaviest thing on the CRM page. */}
      {Object.entries(
        DOTS.reduce<Record<string, string[]>>((acc, p) => {
          (acc[tone(p)] ??= []).push(`M${p[0].toFixed(1)} ${p[1].toFixed(1)}h0`);
          return acc;
        }, {}),
      ).map(([color, d]) => (
        <path key={color} d={d.join("")} stroke={color} strokeWidth={6.2} strokeLinecap="round" fill="none" />
      ))}
      <rect width={W} height={H} fill="url(#map-fade)" pointerEvents="none" />

      {LABELS.map((l) => {
        const [x, y] = xy(l.at);
        return (
          <text key={l.t} x={x} y={y} fontSize="10.5" fontWeight="600" fill="#868c9c" textAnchor="middle">
            {l.t}
          </text>
        );
      })}

      {top.map((t, i) => {
        const [x, y] = t.xy;
        const label = `${t.count} lead${t.count === 1 ? "" : "s"}`;
        const w = 22 + label.length * 6.2;
        // Keep the pill inside the frame on clusters near the edge.
        const px = Math.min(Math.max(x - w / 2, 4), W - w - 4);
        const py = Math.max(y - 40, 4);
        return (
          <g key={i}>
            <line x1={x} y1={y} x2={px + w / 2} y2={py + 22} stroke="#325ced" strokeWidth="1" strokeDasharray="2 2" />
            <rect x={px} y={py} width={w} height={22} rx={11} fill="#fff" stroke="#e2e8f3" />
            <circle cx={px + 11} cy={py + 11} r={4} fill="#325ced" />
            <text x={px + 19} y={py + 15} fontSize="10.5" fontWeight="700" fill="#111318">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
