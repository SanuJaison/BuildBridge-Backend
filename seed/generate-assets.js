const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "..", "public", "static", "demo");
fs.mkdirSync(outDir, { recursive: true });

const palettes = [
  ["#7c3aed", "#2563eb", "#1e1b4b"],
  ["#0ea5e9", "#6366f1", "#082f49"],
  ["#ec4899", "#8b5cf6", "#2e1065"],
  ["#14b8a6", "#3b82f6", "#042f2e"],
  ["#f59e0b", "#ef4444", "#3b0764"],
  ["#22c55e", "#0ea5e9", "#052e16"],
];

const people = [
  ["AC", 0],
  ["MR", 1],
  ["PN", 2],
  ["DA", 3],
  ["NC", 4],
  ["DK", 5],
  ["SW", 0],
  ["GB", 1],
  ["IM", 2],
  ["RM", 3],
  ["TB", 4],
  ["JB", 5],
  ["NW", 0],
  ["VL", 1],
  ["SR", 2],
  ["MO", 3],
  ["LM", 4],
  ["AK", 5],
  ["JL", 2],
  ["BA", 0],
  ["EV", 1],
  ["TK", 3],
  ["RB", 4],
];

people.forEach(([initials, paletteIndex], index) => {
  const [from, to, base] = palettes[paletteIndex];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" role="img" aria-label="${initials} avatar">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
    <radialGradient id="r" cx="30%" cy="20%" r="80%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="400" fill="${base}"/>
  <rect width="400" height="400" fill="url(#g)" opacity="0.9"/>
  <circle cx="95" cy="60" r="190" fill="url(#r)"/>
  <circle cx="330" cy="330" r="120" fill="#ffffff" opacity="0.08"/>
  <path d="M0 300 Q120 240 230 310 T400 260 V400 H0Z" fill="#020617" opacity="0.25"/>
  <text x="200" y="236" font-family="Manrope, Inter, Arial, sans-serif" font-size="132" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="-4">${initials}</text>
</svg>`;
  fs.writeFileSync(path.join(outDir, `avatar-${index + 1}.svg`), svg);
});

for (let index = 0; index < 12; index += 1) {
  const [from, to, base] = palettes[index % palettes.length];
  const offset = (index * 37) % 160;
  const chartBars = Array.from({ length: 6 }, (_, bar) => {
    const height = 40 + ((bar * 43 + index * 29) % 150);
    return `<rect x="${700 + bar * 52}" y="${560 - height}" width="28" height="${height}" rx="8" fill="#ffffff" opacity="${0.22 + bar * 0.06}"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" role="img" aria-label="Abstract project artwork">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${base}"/>
      <stop offset="100%" stop-color="#050814"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${from}" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="${from}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="52" height="52" patternUnits="userSpaceOnUse">
      <path d="M52 0H0V52" fill="none" stroke="#ffffff" stroke-opacity="0.06"/>
    </pattern>
  </defs>
  <rect width="1200" height="800" fill="url(#bg)"/>
  <rect width="1200" height="800" fill="url(#grid)"/>
  <circle cx="${330 + offset}" cy="260" r="320" fill="url(#glow)"/>
  <circle cx="${820 + offset / 2}" cy="640" r="280" fill="url(#glow)" opacity="0.5"/>
  <g transform="translate(90 90)">
    <rect width="620" height="440" rx="28" fill="#0b1224" fill-opacity="0.72" stroke="#ffffff" stroke-opacity="0.14"/>
    <rect x="34" y="34" width="150" height="16" rx="8" fill="#ffffff" opacity="0.55"/>
    <rect x="34" y="66" width="260" height="10" rx="5" fill="#ffffff" opacity="0.18"/>
    <rect x="34" y="118" width="250" height="180" rx="18" fill="url(#accent)" opacity="0.85"/>
    <rect x="306" y="118" width="280" height="84" rx="16" fill="#ffffff" opacity="0.08"/>
    <rect x="306" y="214" width="130" height="84" rx="16" fill="#ffffff" opacity="0.12"/>
    <rect x="448" y="214" width="138" height="84" rx="16" fill="#ffffff" opacity="0.06"/>
    <rect x="34" y="328" width="552" height="12" rx="6" fill="#ffffff" opacity="0.16"/>
    <rect x="34" y="358" width="420" height="12" rx="6" fill="#ffffff" opacity="0.1"/>
    <rect x="34" y="398" width="112" height="30" rx="15" fill="url(#accent)"/>
  </g>
  <g transform="translate(660 250)">
    <rect width="450" height="360" rx="30" fill="#0b1224" fill-opacity="0.6" stroke="#ffffff" stroke-opacity="0.12"/>
    <circle cx="70" cy="76" r="28" fill="url(#accent)"/>
    <rect x="116" y="56" width="200" height="14" rx="7" fill="#ffffff" opacity="0.5"/>
    <rect x="116" y="82" width="130" height="10" rx="5" fill="#ffffff" opacity="0.2"/>
    ${chartBars}
    <rect x="30" y="290" width="390" height="1" fill="#ffffff" opacity="0.12"/>
    <rect x="30" y="314" width="90" height="12" rx="6" fill="url(#accent)" opacity="0.9"/>
    <rect x="140" y="314" width="150" height="12" rx="6" fill="#ffffff" opacity="0.14"/>
  </g>
  <text x="90" y="680" font-family="Manrope, Inter, Arial, sans-serif" font-size="20" letter-spacing="7" fill="#ffffff" opacity="0.4">CONCEPT / 0${index + 1}</text>
  <text x="90" y="725" font-family="Manrope, Inter, Arial, sans-serif" font-size="46" font-weight="700" fill="#ffffff" opacity="0.92">Digital product study</text>
  <circle cx="1100" cy="90" r="46" fill="none" stroke="url(#accent)" stroke-width="2" opacity="0.7"/>
  <circle cx="1100" cy="90" r="12" fill="url(#accent)"/>
</svg>`;
  fs.writeFileSync(path.join(outDir, `work-${index + 1}.svg`), svg);
}

console.log(`Generated ${people.length} avatars and 12 project images in ${outDir}`);
