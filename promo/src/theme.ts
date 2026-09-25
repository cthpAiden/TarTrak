/** The app's own tokens (src/app.css) plus the showreel's map and teammate colours. */
export const C = {
  bg: "#12151a",
  deep: "#0b0d10",
  panel: "#161a20",
  raised: "#1c2129",
  raised2: "#232a33",
  line: "#2a313b",
  line2: "#2e3640",
  fg: "#e8eaed",
  fg2: "#c5ccd5",
  muted: "#9aa4b1",
  amber: "#f0b429",
  onAmber: "#1a1405",
  amberSoft: "rgba(240, 180, 41, 0.14)",
  ok: "#3ecf8e",
  north: "#ff5a4e",
  ground: "#20251d",
  groundDeep: "#161a14",
  contour: "#3b4434",
  contourMajor: "#4b5642",
  road: "#6a705f",
  roadEdge: "#2b3026",
  rail: "#7c8272",
  water: "#1a282c",
  waterEdge: "#2c4046",
  roof: "#3a4136",
  wall: "#262b23",
  bezel: "#0f1318",
  tick: "#d9dee4",
  tickMinor: "#8b95a1",
  ghost: "#00e5ff",
  nomad: "#b388ff",
  vex: "#ff4081",
  extractPmc: "#3ecf8e",
  extractScav: "#f0b429",
  extractShared: "#4fb3ff",
} as const;

export const SPRING_POP = { damping: 12, stiffness: 180, mass: 0.6 } as const;
export const SPRING_SOFT = { damping: 20, stiffness: 120, mass: 1 } as const;
/** Headline words: rise frames, leave frames, size in px. */
export const HEADLINE = { rise: 14, leave: 10, size: 160 } as const;
