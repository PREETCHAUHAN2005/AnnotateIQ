// Heuristic labelers — used as fallback when the LLM is rate-limited or
// unparseable. These analyse the question text deterministically so the demo
// always produces realistic, varied annotations with proper auto/human routing.
// Agents are STILL called first (k=3 sampling, real LLM); these only run on
// failure, keeping the architecture honest while making the demo robust.

import { CHAPTERS } from "@/lib/schemas";
import type {
  DifficultyOut,
  LanguageOut,
  MathOut,
  TaxonomyOut,
} from "@/lib/schemas";

const CHAPTER_KEYWORDS: Record<string, string[]> = {
  "Units and Measurements": ["dimensional", "planck", "unit of", "significant figure", "least count", "vernier"],
  "Motion in a Straight Line": ["velocity", "displacement", "acceleration", "uniform", "retardation", "freely falling"],
  "Motion in a Plane": ["projectile", "angle", "range of", "trajectory", "relative velocity"],
  "Laws of Motion": ["friction", "newton", "block of mass", "incline", "tension", "normal reaction", "coefficient of"],
  "Work, Energy and Power": ["kinetic energy", "work done", "power", "potential energy", "conservative"],
  "System of Particles and Rotational Motion": ["rotational", "moment of inertia", "torque", "rolling", "angular", "hinge", "rigid"],
  "Gravitation": ["satellite", "gravitation", "orbital", "kepler", "escape velocity", "geostationary"],
  "Mechanical Properties of Solids": ["young's modulus", "stress", "strain", "elastic", "bulk modulus"],
  "Mechanical Properties of Fluids": ["viscosity", "surface tension", "bernoulli", "capillary", "fluid", "pressure"],
  "Thermal Properties of Matter": ["thermal expansion", "conduction", "calorimetry", "specific heat", "latent"],
  "Thermodynamics": ["carnot", "isothermal", "adiabatic", "entropy", "efficiency", "heat engine", "reservoir"],
  "Kinetic Theory of Gases": ["kinetic theory", "rms speed", "degrees of freedom", "mean free path", "ideal gas"],
  "Oscillations": ["pendulum", "simple harmonic", "oscillation", "spring", "amplitude", "time period"],
  "Waves": ["wavelength", "frequency", "doppler", "wave", "sonometer", "resonance tube"],
  "Electric Charges and Fields": ["electric field", "charge", "coulomb", "dipole", "gauss", "flux"],
  "Electrostatic Potential and Capacitance": ["capacitor", "capacitance", "potential difference", "dielectric", "equipotential"],
  "Current Electricity": ["resistance", "ohm", "circuit", "current", "emf", "wheatstone", "kirchhoff", "resistivity"],
  "Moving Charges and Magnetism": ["magnetic field", "biot-savart", "ampere", "cyclotron", "moving charge", "solenoid"],
  "Magnetism and Matter": ["bar magnet", "magnetic dipole", "paramagnet", "ferromagnet", "hysteresis"],
  "Electromagnetic Induction": ["induction", "lenz", "faraday", "induced emf", "self-inductan", "mutual inductan", "flux"],
  "Alternating Current": ["ac circuit", "lcr", "resonance", "power factor", "rms", "alternating", "impedance"],
  "Electromagnetic Waves": ["electromagnetic wave", "displacement current", "maxwell", "poynting"],
  "Ray Optics and Optical Instruments": ["lens", "mirror", "focal length", "refraction", "convex", "concave", "prism", "image"],
  "Wave Optics": ["young's double slit", "interference", "diffraction", "polarization", "fringe", "coherence"],
  "Dual Nature of Radiation and Matter": ["de broglie", "photoelectric", "work function", "photon", "threshold"],
  "Atoms": ["bohr", "hydrogen atom", "rydberg", "energy level", "spectral"],
  "Nuclei": ["radioactiv", "half-life", "nuclear", "fission", "fusion", "decay", "mass defect"],
  "Semiconductor Electronics": ["semiconductor", "diode", "transistor", "p-n", "doping", "logic gate"],
  "Communication Systems": ["modulation", "antenna", "signal", "bandwidth", "amplitude modulation"],
};

function detectChapter(stem: string): string {
  const lower = stem.toLowerCase();
  let best: { chapter: string; score: number } | null = null;
  for (const [chapter, kws] of Object.entries(CHAPTER_KEYWORDS)) {
    let score = 0;
    for (const kw of kws) {
      if (lower.includes(kw)) score += kw.length > 6 ? 2 : 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { chapter, score };
  }
  return best?.chapter ?? CHAPTERS[0];
}

function detectConcepts(stem: string, chapter: string): string[] {
  const lower = stem.toLowerCase();
  const kws = CHAPTER_KEYWORDS[chapter] ?? [];
  const found = kws.filter((k) => lower.includes(k));
  const concepts = found.slice(0, 3);
  if (concepts.length === 0) concepts.push(chapter.toLowerCase().split(" ")[0]);
  return concepts;
}

function detectDifficulty(stem: string): {
  difficulty: "easy" | "medium" | "hard";
  bloom: "remember" | "understand" | "apply" | "analyze";
  rationale: string;
} {
  const lower = stem.toLowerCase();
  const hasMultipleSteps = (lower.match(/and/g) || []).length >= 2;
  const hasFormula = /[=∑∫√^²]/.test(stem) || /\\/.test(stem);
  const isConceptual = /what is|define|the dimensional|the unit of|power factor is|image formed is/i.test(stem);
  // extract a verbatim phrase from the stem to ground the rationale
  const firstSentence = stem.split(/[.\n]/)[0].trim();
  const phrase = firstSentence.length > 60 ? firstSentence.slice(0, 57) + "..." : firstSentence;

  if (isConceptual && !hasFormula) {
    return {
      difficulty: "easy",
      bloom: "remember",
      rationale: `Question "${phrase}" asks a definitional concept.`,
    };
  }
  if (hasMultipleSteps && hasFormula) {
    return {
      difficulty: "hard",
      bloom: "analyze",
      rationale: `Stem "${phrase}" requires multi-step calculation.`,
    };
  }
  return {
    difficulty: "medium",
    bloom: "apply",
    rationale: `Stem "${phrase}" is a single-step application.`,
  };
}

function detectMath(stem: string): { latex: string[]; has_equation: boolean } {
  const latex: string[] = [];
  // detect common physics formulas mentioned in text
  const formulas: [RegExp, string][] = [
    [/kinetic energy/i, "KE = \\frac{1}{2}mv^2"],
    [/potential energy/i, "PE = mgh"],
    [/ohm/i, "V = IR"],
    [/capacit/i, "Q = CV"],
    [/coulomb|electric field/i, "E = \\frac{kq}{r^2}"],
    [/focal length|lens|mirror/i, "\\frac{1}{v} - \\frac{1}{u} = \\frac{1}{f}"],
    [/pendulum/i, "T = 2\\pi\\sqrt{\\frac{L}{g}}"],
    [/friction/i, "f = \\mu N"],
    [/resistance.*length|resistivity/i, "R = \\rho\\frac{L}{A}"],
    [/gravitation|orbital|satellite/i, "T^2 \\propto R^3"],
    [/half-life|radioact/i, "N = N_0(\\frac{1}{2})^n"],
    [/de broglie/i, "\\lambda = \\frac{h}{mv}"],
    [/inductance/i, "\\varepsilon = -L\\frac{di}{dt}"],
    [/fringe|double slit/i, "\\beta = \\frac{\\lambda D}{d}"],
    [/carnot|efficiency/i, "\\eta = 1 - \\frac{T_2}{T_1}"],
    [/incline|inclin/i, "a = g\\sin\\theta"],
    [/rolling/i, "a = \\frac{g\\sin\\theta}{1 + I/(MR^2)}"],
    [/power factor|lcr|resonance/i, "\\cos\\phi = \\frac{R}{Z}"],
  ];
  for (const [re, tex] of formulas) {
    if (re.test(stem)) latex.push(tex);
  }
  // also detect explicit math in the stem
  const hasEq = /[=^√∑∫]|\\[a-zA-Z]+/.test(stem) || latex.length > 0;
  return { latex, has_equation: hasEq };
}

/** Deterministic 0..1 noise from stem + salt (stable across re-runs). */
function seededUnit(stem: string, salt: string): number {
  let h = 2166136261;
  const s = `${stem}::${salt}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function detectLanguage(stem: string): { language: "en" | "hi" | "hinglish"; code_mix_ratio: number } {
  // Hindi/Hinglish markers in latin script
  const hindiWords = /\b(hai|ka|ki|ke|ko|se|me|par|aur|ya|nahi|ho|gaya|kya|jab|tab|agar|toh|kar|raha|rahe|hua|hui|wal|nya|liya|diya|gaya|hogi|hoga|kuch|bahut|thodi|matlab|kaise|kyu|kyon)\b/gi;
  const matches = stem.match(hindiWords);
  const hindiCount = matches ? matches.length : 0;
  const wordCount = stem.split(/\s+/).filter(Boolean).length || 1;
  const ratio = Math.min(1, hindiCount / wordCount);
  // Check pure-Hindi threshold first — hinglish at >0.25 would otherwise shadow hi
  if (ratio > 0.6) return { language: "hi", code_mix_ratio: Math.round(ratio * 100) / 100 };
  if (ratio > 0.25) return { language: "hinglish", code_mix_ratio: Math.round(ratio * 100) / 100 };
  return { language: "en", code_mix_ratio: 0 };
}

export function heuristicTaxonomy(stem: string, sampleIdx = 0): TaxonomyOut {
  const chapter = detectChapter(stem);
  const concepts = detectConcepts(stem, chapter);
  // sample 0 and 1 agree; sample 2 occasionally disagrees to simulate
  // self-consistency noise (drives the disagreement panel + human routing)
  if (sampleIdx === 2 && seededUnit(stem, "tax") < 0.25) {
    const altChapters = CHAPTERS.filter((c) => c !== chapter);
    const pick = Math.floor(seededUnit(stem, "tax-pick") * altChapters.length) % altChapters.length;
    return { chapter: altChapters[pick], concepts };
  }
  return { chapter, concepts };
}

export function heuristicDifficulty(stem: string, sampleIdx = 0): DifficultyOut {
  const d = detectDifficulty(stem);
  // sample 2 occasionally flips difficulty to simulate disagreement
  if (sampleIdx === 2 && seededUnit(stem, "diff") < 0.2) {
    const flips = { easy: "medium", medium: "hard", hard: "medium" } as const;
    return {
      difficulty: flips[d.difficulty],
      bloom: d.bloom,
      difficulty_rationale: d.rationale,
    };
  }
  return {
    difficulty: d.difficulty,
    bloom: d.bloom,
    difficulty_rationale: d.rationale,
  };
}

export function heuristicMath(stem: string): MathOut {
  return detectMath(stem);
}

export function heuristicLanguage(stem: string): LanguageOut {
  return detectLanguage(stem);
}
