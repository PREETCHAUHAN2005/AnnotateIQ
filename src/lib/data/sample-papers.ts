// Curated JEE Physics sample papers for the demo.
// Each paper is a set of pre-segmented question units (regex-segmented feel).
// A subset carry goldPayload -> these seed honeypots across every job.

export type SampleUnit = {
  seq: number;
  page: number;
  stem: string;
  options: string[] | null;
  gold?: {
    chapter: string;
    concepts: string[];
    difficulty: "easy" | "medium" | "hard";
    bloom: "remember" | "understand" | "apply" | "analyze";
    language: "en" | "hi" | "hinglish";
    codeMixRatio: number;
    hasEquation: boolean;
    latex: string[];
  };
};

export type SamplePaper = {
  id: string;
  filename: string;
  kind: "clean" | "scanned" | "figure-heavy";
  description: string;
  units: SampleUnit[];
};

export const SAMPLE_PAPERS: SamplePaper[] = [
  {
    id: "jee-main-2024-shift1",
    filename: "JEE_Main_2024_Jan_Physics_Shift1.pdf",
    kind: "clean",
    description: "JEE Main 2024 January — clean digital PDF, 8 questions",
    units: [
      {
        seq: 1,
        page: 1,
        stem:
          "A body is moving with uniform velocity. Its acceleration is: (a) zero (b) non-zero (c) infinite (d) none of these. Choose the correct option.",
        options: ["zero", "non-zero", "infinite", "none of these"],
        gold: {
          chapter: "Motion in a Straight Line",
          concepts: ["uniform velocity", "acceleration"],
          difficulty: "easy",
          bloom: "remember",
          language: "en",
          codeMixRatio: 0.0,
          hasEquation: false,
          latex: [],
        },
      },
      {
        seq: 2,
        page: 1,
        stem:
          "A particle moves in a straight line such that its displacement is given by x = 6t^2 - t^3. The time at which the particle comes to rest is:",
        options: ["2 s", "4 s", "6 s", "8 s"],
        gold: {
          chapter: "Motion in a Straight Line",
          concepts: ["displacement", "velocity", "differentiation"],
          difficulty: "medium",
          bloom: "apply",
          language: "en",
          codeMixRatio: 0.0,
          hasEquation: true,
          latex: ["x = 6t^2 - t^3", "v = dx/dt = 12t - 3t^2"],
        },
      },
      {
        seq: 3,
        page: 1,
        stem:
          "A block of mass 2 kg rests on a horizontal surface. The coefficient of static friction is 0.4. The maximum horizontal force that can be applied without moving the block is (g = 10 m/s^2):",
        options: ["4 N", "8 N", "12 N", "20 N"],
        gold: {
          chapter: "Laws of Motion",
          concepts: ["friction", "static friction", "normal reaction"],
          difficulty: "medium",
          bloom: "apply",
          language: "en",
          codeMixRatio: 0.0,
          hasEquation: true,
          latex: ["f_s = \\mu_s N", "N = mg"],
        },
      },
      {
        seq: 4,
        page: 2,
        stem:
          "A solid sphere of mass M and radius R rolls without slipping down an inclined plane of angle θ. The acceleration of its centre of mass is:",
        options: [
          "(5/7) g sin θ",
          "(2/3) g sin θ",
          "g sin θ",
          "(3/5) g sin θ",
        ],
        gold: {
          chapter: "System of Particles and Rotational Motion",
          concepts: ["rolling", "inclined plane", "moment of inertia"],
          difficulty: "hard",
          bloom: "analyze",
          language: "en",
          codeMixRatio: 0.0,
          hasEquation: true,
          latex: ["a = \\frac{g \\sin\\theta}{1 + I/(MR^2)}", "I = \\frac{2}{5}MR^2"],
        },
      },
      {
        seq: 5,
        page: 2,
        stem:
          "Two point charges +q and -q are separated by a distance 2a. The electric field at the midpoint of the line joining them is:",
        options: ["zero", "kq/a^2", "2kq/a^2", "4kq/a^2"],
        gold: {
          chapter: "Electric Charges and Fields",
          concepts: ["electric dipole", "electric field", "superposition"],
          difficulty: "medium",
          bloom: "apply",
          language: "en",
          codeMixRatio: 0.0,
          hasEquation: true,
          latex: ["E = kq/r^2", "E_{net} = 2E"],
        },
      },
      {
        seq: 6,
        page: 3,
        stem:
          "A capacitor of capacitance 2 μF is charged to 100 V. The energy stored in it is:",
        options: ["0.01 J", "0.02 J", "0.1 J", "0.2 J"],
        gold: {
          chapter: "Electrostatic Potential and Capacitance",
          concepts: ["capacitor", "energy stored"],
          difficulty: "easy",
          bloom: "apply",
          language: "en",
          codeMixRatio: 0.0,
          hasEquation: true,
          latex: ["U = \\frac{1}{2}CV^2"],
        },
      },
      {
        seq: 7,
        page: 3,
        stem:
          "Ek wire ka resistance 10 ohm hai. Agar iski length double kar di jaye aur area half ho jaye, toh naya resistance kitna hoga?",
        options: ["10 Ω", "20 Ω", "40 Ω", "5 Ω"],
        gold: {
          chapter: "Current Electricity",
          concepts: ["resistance", "resistivity", "dependence on dimensions"],
          difficulty: "medium",
          bloom: "apply",
          language: "hinglish",
          codeMixRatio: 0.35,
          hasEquation: true,
          latex: ["R = \\rho \\frac{L}{A}"],
        },
      },
      {
        seq: 8,
        page: 4,
        stem:
          "A convex lens of focal length 20 cm forms an image of an object placed 30 cm from it. The image distance is:",
        options: ["60 cm", "12 cm", "-60 cm", "30 cm"],
        gold: {
          chapter: "Ray Optics and Optical Instruments",
          concepts: ["convex lens", "lens formula", "image formation"],
          difficulty: "medium",
          bloom: "apply",
          language: "en",
          codeMixRatio: 0.0,
          hasEquation: true,
          latex: ["\\frac{1}{v} - \\frac{1}{u} = \\frac{1}{f}"],
        },
      },
    ],
  },
  {
    id: "jee-adv-2023-paper1",
    filename: "JEE_Advanced_2023_Paper1_Physics.pdf",
    kind: "scanned",
    description: "JEE Advanced 2023 Paper 1 — scanned paper, 8 questions",
    units: [
      {
        seq: 1,
        page: 1,
        stem:
          "A satellite is revolving around the earth in a circular orbit of radius R. The time period of revolution is T. If the radius is increased to 4R, the new time period is:",
        options: null,
        gold: {
          chapter: "Gravitation",
          concepts: ["satellite", "orbital period", "Kepler's law"],
          difficulty: "medium",
          bloom: "apply",
          language: "en",
          codeMixRatio: 0.0,
          hasEquation: true,
          latex: ["T^2 \\propto R^3"],
        },
      },
      {
        seq: 2,
        page: 1,
        stem:
          "A simple pendulum of length L has a time period T on the earth. If it is taken to a planet where acceleration due to gravity is g/4, the new time period is:",
        options: null,
        gold: {
          chapter: "Oscillations",
          concepts: ["simple pendulum", "time period", "gravity"],
          difficulty: "medium",
          bloom: "apply",
          language: "en",
          codeMixRatio: 0.0,
          hasEquation: true,
          latex: ["T = 2\\pi\\sqrt{\\frac{L}{g}}"],
        },
      },
      {
        seq: 3,
        page: 2,
        stem:
          "An ideal gas undergoes an isothermal expansion from volume V to 2V at temperature T. The work done by the gas is:",
        options: null,
        gold: {
          chapter: "Thermodynamics",
          concepts: ["isothermal process", "work done", "ideal gas"],
          difficulty: "hard",
          bloom: "apply",
          language: "en",
          codeMixRatio: 0.0,
          hasEquation: true,
          latex: ["W = nRT \\ln\\frac{V_2}{V_1}"],
        },
      },
      {
        seq: 4,
        page: 2,
        stem:
          "A uniform rod of length L and mass M is hinged at one end. It is released from rest in horizontal position. The angular velocity when it becomes vertical is:",
        options: null,
        gold: {
          chapter: "System of Particles and Rotational Motion",
          concepts: ["rotational motion", "energy conservation", "moment of inertia"],
          difficulty: "hard",
          bloom: "analyze",
          language: "en",
          codeMixRatio: 0.0,
          hasEquation: true,
          latex: ["\\frac{1}{2}I\\omega^2 = Mg\\frac{L}{2}", "I = \\frac{1}{3}ML^2"],
        },
      },
      {
        seq: 5,
        page: 3,
        stem:
          "A coil of self-inductance 2 H carries a current that changes at the rate of 4 A/s. The emf induced in the coil is:",
        options: null,
        gold: {
          chapter: "Electromagnetic Induction",
          concepts: ["self inductance", "induced emf"],
          difficulty: "easy",
          bloom: "apply",
          language: "en",
          codeMixRatio: 0.0,
          hasEquation: true,
          latex: ["\\varepsilon = -L\\frac{di}{dt}"],
        },
      },
      {
        seq: 6,
        page: 3,
        stem:
          "In Young's double slit experiment, the fringe width is β. If the wavelength of light is doubled and slit separation is halved, the new fringe width is:",
        options: null,
        gold: {
          chapter: "Wave Optics",
          concepts: ["young's double slit", "fringe width", "interference"],
          difficulty: "medium",
          bloom: "apply",
          language: "en",
          codeMixRatio: 0.0,
          hasEquation: true,
          latex: ["\\beta = \\frac{\\lambda D}{d}"],
        },
      },
      {
        seq: 7,
        page: 4,
        stem:
          "The de Broglie wavelength associated with a particle of mass m moving with velocity v is λ. If the velocity is doubled, the new de Broglie wavelength is:",
        options: null,
        gold: {
          chapter: "Dual Nature of Radiation and Matter",
          concepts: ["de broglie wavelength", "matter waves"],
          difficulty: "easy",
          bloom: "apply",
          language: "en",
          codeMixRatio: 0.0,
          hasEquation: true,
          latex: ["\\lambda = \\frac{h}{mv}"],
        },
      },
      {
        seq: 8,
        page: 4,
        stem:
          "Half-life of a radioactive sample is 10 years. The fraction remaining after 30 years is:",
        options: null,
        gold: {
          chapter: "Nuclei",
          concepts: ["radioactivity", "half life", "decay"],
          difficulty: "medium",
          bloom: "apply",
          language: "en",
          codeMixRatio: 0.0,
          hasEquation: true,
          latex: ["N = N_0 \\left(\\frac{1}{2}\\right)^n", "n = t/T_{1/2}"],
        },
      },
    ],
  },
  {
    id: "jee-main-2023-figure",
    filename: "JEE_Main_2023_Physics_Figures.pdf",
    kind: "figure-heavy",
    description: "JEE Main 2023 — figure-heavy paper with circuit and ray diagrams, 8 questions",
    units: [
      {
        seq: 1,
        page: 1,
        stem:
          "[Figure: a circuit with a 12 V battery connected to two resistors 4 Ω and 6 Ω in series] The current flowing through the circuit is:",
        options: ["1.2 A", "2 A", "0.5 A", "3 A"],
        gold: {
          chapter: "Current Electricity",
          concepts: ["series circuit", "ohm's law", "equivalent resistance"],
          difficulty: "easy",
          bloom: "apply",
          language: "en",
          codeMixRatio: 0.0,
          hasEquation: true,
          latex: ["I = \\frac{V}{R_{eq}}", "R_{eq} = R_1 + R_2"],
        },
      },
      {
        seq: 2,
        page: 1,
        stem:
          "[Figure: a block of mass m on an inclined plane at angle 30°] A block of mass m = 5 kg is placed on a frictionless incline of angle 30°. The acceleration of the block down the incline is (g = 10 m/s²):",
        options: ["5 m/s²", "10 m/s²", "2.5 m/s²", "8.66 m/s²"],
        gold: {
          chapter: "Laws of Motion",
          concepts: ["incline", "component of gravity", "acceleration"],
          difficulty: "medium",
          bloom: "apply",
          language: "en",
          codeMixRatio: 0.0,
          hasEquation: true,
          latex: ["a = g\\sin\\theta"],
        },
      },
      {
        seq: 3,
        page: 2,
        stem:
          "[Figure: a concave mirror with object placed beyond C] An object is placed beyond the centre of curvature C of a concave mirror of focal length f. The image formed is:",
        options: [
          "real, inverted, diminished",
          "virtual, erect, enlarged",
          "real, inverted, enlarged",
          "virtual, erect, diminished",
        ],
        gold: {
          chapter: "Ray Optics and Optical Instruments",
          concepts: ["concave mirror", "image formation", "magnification"],
          difficulty: "medium",
          bloom: "understand",
          language: "en",
          codeMixRatio: 0.0,
          hasEquation: false,
          latex: [],
        },
      },
      {
        seq: 4,
        page: 2,
        stem:
          "A Carnot engine operates between 400 K and 300 K. The efficiency of the engine is:",
        options: ["25%", "33%", "50%", "75%"],
        gold: {
          chapter: "Thermodynamics",
          concepts: ["carnot engine", "efficiency", "heat reservoirs"],
          difficulty: "medium",
          bloom: "apply",
          language: "en",
          codeMixRatio: 0.0,
          hasEquation: true,
          latex: ["\\eta = 1 - \\frac{T_2}{T_1}"],
        },
      },
      {
        seq: 5,
        page: 3,
        stem:
          "[Figure: a bar magnet moving into a solenoid] A bar magnet is moved towards a stationary solenoid. The direction of induced current in the solenoid, by Lenz's law, will be such as to:",
        options: [
          "oppose the motion of the magnet",
          "aid the motion of the magnet",
          "be zero",
          "reverse periodically",
        ],
        gold: {
          chapter: "Electromagnetic Induction",
          concepts: ["lenz's law", "induced current", "conservation of energy"],
          difficulty: "medium",
          bloom: "understand",
          language: "en",
          codeMixRatio: 0.0,
          hasEquation: false,
          latex: [],
        },
      },
      {
        seq: 6,
        page: 3,
        stem:
          "A body of mass 2 kg is moving with a velocity of 10 m/s. Its kinetic energy is:",
        options: ["10 J", "50 J", "100 J", "200 J"],
        gold: {
          chapter: "Work, Energy and Power",
          concepts: ["kinetic energy", "mass", "velocity"],
          difficulty: "easy",
          bloom: "apply",
          language: "en",
          codeMixRatio: 0.0,
          hasEquation: true,
          latex: ["KE = \\frac{1}{2}mv^2"],
        },
      },
      {
        seq: 7,
        page: 4,
        stem:
          "The dimensional formula of Planck's constant h is:",
        options: ["[ML²T⁻¹]", "[ML²T⁻²]", "[MLT⁻¹]", "[ML²T]"],
        gold: {
          chapter: "Units and Measurements",
          concepts: ["dimensional analysis", "planck's constant"],
          difficulty: "medium",
          bloom: "remember",
          language: "en",
          codeMixRatio: 0.0,
          hasEquation: true,
          latex: ["E = h\\nu"],
        },
      },
      {
        seq: 8,
        page: 4,
        stem:
          "In an LCR series AC circuit at resonance, the power factor is:",
        options: ["0", "0.5", "1", "infinity"],
        gold: {
          chapter: "Alternating Current",
          concepts: ["lcr circuit", "resonance", "power factor"],
          difficulty: "medium",
          bloom: "understand",
          language: "en",
          codeMixRatio: 0.0,
          hasEquation: true,
          latex: ["\\cos\\phi = \\frac{R}{Z}"],
        },
      },
    ],
  },
];

// Gold honeypot set — used to seed honeypots into every job.
// We take the first N gold-tagged units across papers as the honeypot pool.
export function buildHoneypotPool() {
  const pool: {
    seq: number;
    stem: string;
    options: string[] | null;
    goldPayload: object;
  }[] = [];
  let idx = 0;
  for (const paper of SAMPLE_PAPERS) {
    for (const u of paper.units) {
      if (!u.gold) continue;
      idx++;
      pool.push({
        seq: idx,
        stem: u.stem,
        options: u.options,
        goldPayload: {
          chapter: u.gold.chapter,
          concepts: u.gold.concepts,
          difficulty: u.gold.difficulty,
          bloom: u.gold.bloom,
          language: u.gold.language,
          codeMixRatio: u.gold.codeMixRatio,
          hasEquation: u.gold.hasEquation,
          latex: u.gold.latex,
        },
      });
    }
  }
  return pool;
}
