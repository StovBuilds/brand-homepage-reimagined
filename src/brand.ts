// Everything brand-specific lives in this file: names, copy, colours and the
// model. Swap these out to point the same scroll film at another brand.
// See "Swap in your own brand" in the README.

export interface Colourway {
  name: string;
  bg: string;
  ink: string;
  chip: string;
  /** Material name in the GLB -> colour. */
  mats: Record<string, string>;
}

export const BRAND = {
  /** The brand this concept studies. Plain text only: no logos, no marks. */
  name: "Nike",
  /** Who owns the name, for the disclaimer. */
  owner: "Nike, Inc.",
  /** Top-left wordmark, set in our own type. */
  wordmark: "NIKE",
  wordmarkSub: "/ REIMAGINED",
  docTitle: "Nike, reimagined (an unofficial concept)",
  /** The trainer the page loads. runner.glb is the fully scripted model. */
  model: `${import.meta.env.BASE_URL}models/runner-hybrid.glb`,
  heroLines: ["NOTHING", "STANDS", "STILL."],
  heroKicker: "RUNNER 01 · A CONCEPT TRAINER",
  heroLine: "A homepage that moves the way the brand talks. Scroll and it runs.",
  finale: ["YOUR", "MOVE."] as const,
  cta: { label: "Want this for your brand?", href: "https://adaptprogressevolve.com/" },
};

export const SPORTS = [
  { word: "RUN", line: "Road, track, treadmill. Start here." },
  { word: "TRAIN", line: "Lift, jump, repeat." },
  { word: "COURT", line: "Hard stops. Sharp cuts." },
  { word: "TRAIL", line: "Mud is a surface too." },
];

/** part = the object name in the GLB the leader line points at. */
export const CALLOUTS: { part: string; label: string; sub: string; side: 1 | -1 }[] = [
  { part: "upper", label: "MESH UPPER", sub: "one piece, lined", side: 1 },
  { part: "clip", label: "HEEL CLIP", sub: "moulded counter", side: -1 },
  { part: "midsole", label: "FOAM MIDSOLE", sub: "full length", side: 1 },
  { part: "outsole", label: "RUBBER OUTSOLE", sub: "heel to toe", side: -1 },
];

export const CARDS = [
  { k: "01", h: "FIRST IN LINE", b: "Early access to every drop." },
  { k: "02", h: "THE CLUB", b: "Run with people at your pace." },
  { k: "03", h: "MADE TO MOVE", b: "Training plans that change as you do." },
];

export const COLOURWAYS: Colourway[] = [
  {
    name: "FIRST LIGHT", bg: "#ff4a1c", ink: "#0b0b0c", chip: "#f4f3ef",
    mats: { upperMat: "#ecebe5", railMat: "#aeada8", liningMat: "#0d0d0e", tongueMat: "#101012", laceMat: "#ffffff", clipMat: "#0d0d0e", midMat: "#f6f5f1", plateMat: "#0d0d0e", outMat: "#0d0d0e" },
  },
  {
    name: "NIGHT SHIFT", bg: "#0b0b0c", ink: "#d6ff1f", chip: "#d6ff1f",
    mats: { upperMat: "#16161a", railMat: "#24242a", liningMat: "#050506", tongueMat: "#1e1e24", laceMat: "#d6ff1f", clipMat: "#d6ff1f", midMat: "#f1f0ea", plateMat: "#d6ff1f", outMat: "#16161a" },
  },
  {
    name: "LIVE WIRE", bg: "#d6ff1f", ink: "#0b0b0c", chip: "#ff4a1c",
    mats: { upperMat: "#ff4a1c", railMat: "#e23a10", liningMat: "#0d0d0e", tongueMat: "#0d0d0e", laceMat: "#0d0d0e", clipMat: "#0d0d0e", midMat: "#111113", plateMat: "#f4f3ef", outMat: "#f4f3ef" },
  },
  {
    name: "CHALK LINE", bg: "#efeee9", ink: "#2440ff", chip: "#2440ff",
    mats: { upperMat: "#e6e3da", railMat: "#cfccc2", liningMat: "#1a1a1e", tongueMat: "#d6d3c9", laceMat: "#2440ff", clipMat: "#2440ff", midMat: "#fbfaf6", plateMat: "#2440ff", outMat: "#b88a55" },
  },
];

/** Worn on the black sections, where a colourway's black parts would vanish. */
export const STUDIO: Colourway = {
  name: "STUDIO", bg: "#0b0b0c", ink: "#ffffff", chip: "#ffffff",
  mats: { upperMat: "#f4f3ef", railMat: "#d2d0c8", liningMat: "#1b1b20", tongueMat: "#34343c", laceMat: "#ffffff", clipMat: "#ff4a1c", midMat: "#f6f5f1", plateMat: "#ff4a1c", outMat: "#ff4a1c" },
};
