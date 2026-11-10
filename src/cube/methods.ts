// Intermediate and expert methods for the 2×2 and 3×3; big cubes reuse them for their 3×3 part
import { FACES, PIECES, SCHEME, SOLVED, STICKERS, isSolved, move, relabel as afterY, scramble, toMoves, type Size, type State } from './model.ts'
import { bigCube } from './big.ts'
import { CORNERS, crossDone, count, f2l, layer, pick, place, placed, positioned, stageDone, topEdges, turns, whole, type Chunk, type Line, type Opt } from './solver.ts'
import { optimal2, optimalSet, twoPhase } from './twophase.ts'

export type Level = 'beginner' | 'intermediate' | 'expert'
export const LEVELS: Level[] = ['beginner', 'intermediate', 'expert']

// Teaching content per level
export const STAGES_INT = [
  {
    title: 'Cross',
    goal: 'Build the white cross on the bottom in as few moves as possible, each edge matching its side center.',
    why: 'Planning all four edges together, instead of a daisy first, takes about half the moves. The guide shows the shortest cross there is.',
    look: 'Before turning anything, find all four white edges. Work out which one is closest to home and whether the next can ride along in the same moves.',
  },
  {
    title: 'First two layers (F2L)',
    goal: 'Pair each white corner with its middle-layer edge on top, then drop the pair into its slot.',
    why: 'Solving a corner and its edge together finishes a whole slot at once, instead of all corners first and all edges after.',
    look: "Find a white corner on top and the edge that shares its two side colors. Turn the top to join them, then insert with R U R' or F' U' F.",
  },
  {
    title: 'Orient the last layer (2-look OLL)',
    goal: 'Make the whole top yellow: first a yellow cross, then the corners.',
    why: "F R U R' U' F' flips edges two at a time; seven short algorithms cover every corner pattern.",
    look: 'Count the yellow corner stickers on top, then look at where the others face: that picks the algorithm.',
  },
  {
    title: 'Permute the last layer (2-look PLL)',
    goal: 'Move the top pieces to their places: corners first, then edges.',
    why: 'T-perm swaps two neighbouring corners, Y-perm swaps two opposite ones; four edge cycles finish the cube.',
    look: 'Look for headlights, two matching corner stickers on one side. Headlights mean a neighbouring swap; none means a diagonal one.',
  },
]
export const STAGES2_INT = [
  { title: 'First layer', goal: 'Build the white layer on the bottom in as few moves as possible.', why: 'The guide finds the shortest way to put all four white corners home at once.', look: 'Pick the white corner that is easiest to keep, then bring the others around it.' },
  { title: 'Orient the top', goal: 'Turn every top corner yellow-up with one algorithm.', why: 'The same seven corner algorithms as on a 3×3 cover every 2×2 top.', look: 'Count the yellow stickers on top, then turn the top until the case matches.' },
  { title: 'Permute the top', goal: 'Put the top corners in their places to finish.', why: 'T-perm swaps two neighbouring corners and Y-perm two opposite ones.', look: 'Two matching stickers on one side mean a neighbouring swap; none means a diagonal swap.' },
]
export const STAGES_EXP = [
  { title: 'Phase 1: orient everything', goal: 'Every piece ends with yellow or white facing up or down, and the middle edges sit in the middle layer.', why: "Kociemba's two-phase method: first reach a position the second phase can finish using only top, bottom and half turns.", look: 'Nothing to read here: these are computer-found moves. Follow them exactly.' },
  { title: 'Phase 2: finish', goal: 'Put every piece home without undoing phase 1.', why: 'Only top, bottom and half turns are used, so every piece stays the right way round while it travels home.', look: 'Follow the moves exactly. The whole solve is about 20 moves.' },
]
export const STAGES2_EXP = [
  { title: 'Shortest solve', goal: 'Solve the cube in the fewest moves possible.', why: 'The guide searched every 2×2 position: none needs more than 11 moves, and this is the shortest for yours.', look: 'These are computer-found moves. Follow them exactly.' },
]

// Lines of a few moves each, so long computer solutions stay readable
const lines = (alg: string, note: (i: number) => string, size = 5): Line[] => {
  const ms = toMoves(alg), out: Line[] = []
  for (let i = 0; i < ms.length; i += size) out.push({ alg: ms.slice(i, i + size).join(' '), note: note(i / size) })
  return out
}

const SUNE = "R U R' U R U2 R'"
const OLL_EDGES: Opt[] = [
  ...turns('U', 'Turn the top so the yellow L points back-left, or the line runs left to right.'),
  { alg: "F R U R' U' F'", note: 'Flip two top edges: a line becomes the cross.' },
  { alg: "F U R U' R' F'", note: 'Flip two top edges: an L becomes the cross.' },
]
const OLL_CORNERS: Opt[] = [
  ...turns('U', 'Turn the top so the corners match the algorithm.'),
  { alg: SUNE, note: 'Sune: one yellow corner up, held at front-left.' },
  { alg: "R U2 R' U' R U' R'", note: 'Antisune: one yellow corner up, held at back-right.' },
  { alg: "R U R' U R U' R' U R U2 R'", note: 'H: no corners up, matching pairs on the left and right.' },
  { alg: "R U2 R2 U' R2 U' R2 U2 R", note: 'Pi: no corners up, a pair on the left.' },
  { alg: "R2 D R' U2 R D' R' U2 R'", note: 'Headlights: two corners up, the yellow pair facing you.' },
  { alg: "R U R' U' R' F R F'", note: 'T: two corners up, yellow stickers facing left.' },
  { alg: "F R' F' R U R U' R'", note: 'Bowtie: two diagonal corners up.' },
]
const PLL_CORNERS: Opt[] = [
  ...turns('U', 'Turn the top so the headlights face left.'),
  ...turns('y', 'Turn the whole cube so the headlights are on the left.'),
  { alg: "R U R' U' R' F R2 U' R' U' R U R' F'", note: 'T-perm: swap the two corners on the right.' },
  { alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'", note: 'Y-perm: swap two opposite corners.' },
]
const PLL_EDGES: Opt[] = [
  ...turns('U', 'Turn the top to line the corners up.'),
  ...turns('y', 'Turn the whole cube so the solved edge is at the back.'),
  { alg: "R U' R U R U R U' R' U' R2", note: 'Ua: cycle three edges, the back one stays.' },
  { alg: "R2 U R U R' U' R' U' R' U R'", note: 'Ub: cycle three edges the other way.' },
  { alg: "R2 U2 R U2 R2 U2 R2 U2 R U2 R2", note: 'H: swap opposite edges in pairs.' },
  { alg: "R' U' R U' R U R U' R' U R U R2 U' R'", note: 'Z: swap neighbouring edges in pairs.' },
]
const F2L: Opt[] = [
  ...turns('U', 'Turn the top to join the corner and edge, or to park them above their slot.'),
  ...turns('y', 'Turn the whole cube so the slot you are filling is at front-right.'),
  ...[["R U R'", 'R'], ["R U' R'", 'R'], ["R U2 R'", 'R'], ["F' U F", 'F'], ["F' U' F", 'F'], ["F' U2 F", 'F']].map(([alg, f]) => ({ alg, fam: 'T' + f, note: f === 'R' ? 'Lift the slot with R, move the pair with the top, and drop it back.' : "Lift the slot with F', move the pair with the top, and drop it back." })),
]

// A middle-layer edge whose corner below shares both its side faces
const sides = (p: number[]) => p.map(i => STICKERS[i].face).filter(f => f !== 'U' && f !== 'D').sort().join()
const cornerUnder = new Map(PIECES.filter(p => p.length === 2 && layer(p) === 0).map(e => [e.join(), CORNERS.find(c => layer(c) === -1 && sides(c) === sides(e))!]))
const pairDone = (s: State, p: number[]) => p.length === 2 && layer(p) === 0 && placed(s, p) && placed(s, cornerUnder.get(p.join())!)
const topYellow = (s: State) => [0, 1, 2, 3, 5, 6, 7, 8].every(i => s[i] === '_' || s[i] === s[4]) // '_': a 2×2 has no edges

// 2-look OLL then 2-look PLL; `bottom` says the first layers are intact (corners only on a 2×2), `edges` false on a 2×2
type Step = (s: State, bottom: (s: State) => boolean, edges: boolean) => [State, Chunk[]]
export const ollSteps: Step = (s, bottom, edges) => {
  const out: Chunk[] = []
  if (edges) { const r = whole(s, OLL_EDGES, x => bottom(x) && topEdges.every(p => p.some(i => STICKERS[i].face === 'U' && x[i] === x[4])), 4, 'Make the yellow cross'); s = r[0]; out.push(...r[1]) }
  const r = whole(s, OLL_CORNERS, x => bottom(x) && topYellow(x), 3, 'Turn every corner yellow-up')
  return [r[0], [...out, ...r[1]]]
}
export const pllSteps: Step = (s, bottom, edges) => {
  // Corners count as in place up to a top turn: the edge step lines the top up, so a hint never undoes the corner step
  const home = (x: State) => ['', 'U', 'U2', "U'"].some(u => CORNERS.filter(p => layer(p) === 1).every(p => positioned(move(x, u), p)))
  const a = whole(s, PLL_CORNERS, x => bottom(x) && topYellow(x) && home(x), 4, 'Put the corners in place')
  const b = whole(a[0], edges ? PLL_EDGES : turns('U', 'Turn the top to finish.'), isSolved, 4, edges ? 'Put the edges in place' : 'Finish')
  return [b[0], [...a[1], ...b[1]]]
}
export function lastLayerSteps(s: State, bottom: (s: State) => boolean, edges: boolean): [State, Chunk[], Chunk[]] {
  const [s1, oll] = ollSteps(s, bottom, edges), [s2, pll] = pllSteps(s1, bottom, edges)
  return [s2, oll, pll]
}


// Cross and F2L: the first two layers
export function firstLayers(s: State): [State, Chunk[], Chunk[]] {
  const cross = optimalSet(s, 'e', s[31])
  const f = place(move(s, cross), F2L, pairDone, 6, p => `Pair and insert the ${p.replace(/ edge$/, '')} pair`, x => count(x, crossDone) === 4)
  return [f[0], cross ? [{ title: 'Build the cross', lines: [{ alg: cross, note: 'All four white edges home, each matching its side center.' }] }] : [], f[1]]
}

// 3×3 intermediate (CFOP with 2-look last layer): one list of chunks per STAGES_INT stage
export function solveIntermediate(start: State): Chunk[][] {
  const [s, cross, f2lChunks] = firstLayers(start)
  const [, oll, pll] = lastLayerSteps(s, f2l, true)
  return [cross, f2lChunks, oll, pll]
}

// The 24 ways the six colors can sit around a cube, as center layouts, to read a centerless 2×2 against
const GRIPS = ['', 'x', "x'", 'x2', 'z', "z'"].flatMap(a => ['', 'y', "y'", 'y2'].map(b => `${a} ${b}`.trim()))
const FRAMES = GRIPS.map(g => bigCube(3).move(SOLVED, g))
const withFrame = (cube: State, f: State) => cube.map((c, k) => (k % 9 === 4 ? f[k] : c))
const relabel = (cube: State, f: State) => { const map = Object.fromEntries(FACES.map((F, k) => [f[k * 9 + 4], SCHEME[F]])); return cube.map(c => map[c] ?? c) }

// 2×2 intermediate and expert. Returns the framed start (invisible centers) and the plan; keep: stay in the cube's own frame (hints)
export function solve2(cube: State, level: Level, keep = false): { start: State; plan: Chunk[][] } {
  if (level === 'expert') {
    // The frame where the back-left-bottom corner is already home: then U, R and F alone reach the optimum
    const f = FRAMES.find(fr => [33, 42, 53].every(k => relabel(cube, fr)[k] === SOLVED[k]))!
    const sol = optimal2(relabel(cube, f))
    return { start: withFrame(cube, f), plan: [sol ? [{ title: 'Shortest solve', lines: lines(sol, i => (i ? 'Keep going.' : 'Hold the cube the way you painted it and follow along.')) }] : []] }
  }
  // Intermediate: the white-down frame with the shortest solve
  const bottom = (x: State) => CORNERS.filter(p => layer(p) === -1).every(p => placed(x, p))
  const own = keep ? FRAMES.filter(f => f.every((c, i) => i % 9 !== 4 || c === cube[i])) : []
  const tries = (own.length ? own : FRAMES.filter(f => f[31] === 'w')).map(f => {
    const start = withFrame(cube, f), first = optimalSet(relabel(start, f), 'c', 'w')
    const [, oll, pll] = lastLayerSteps(move(start, first), bottom, false)
    const plan = [first ? [{ title: 'Build the white layer', lines: [{ alg: first, note: 'All four white corners home, white facing down.' }] }] : [], oll, pll]
    return { start, plan, n: plan.flat().flatMap(c => c.lines).reduce((t, l) => t + toMoves(l.alg).length, 0) }
  })
  const best = tries.reduce((a, b) => (b.n < a.n ? b : a))
  return { start: best.start, plan: best.plan }
}

// 3×3 expert: two-phase, shown as its two phases
export function solveExpert(start: State): Chunk[][] {
  const { moves, split } = twoPhase(start)
  const ms = toMoves(moves), p1 = ms.slice(0, split).join(' '), p2 = ms.slice(split).join(' ')
  return [
    p1 ? [{ title: 'Phase 1', lines: lines(p1, i => (i ? 'Keep going.' : 'Every piece will end facing up or down.')) }] : [],
    p2 ? [{ title: 'Phase 2', lines: lines(p2, i => (i ? 'Keep going.' : 'Only top, bottom and half turns from here.')) }] : [],
  ]
}

// Plan any 2×2 or 3×3 at a level (beginner plans come from solver.ts)
export function planSmall(cube: State, size: Size, level: Level, keep = false) {
  if (size === 2) return solve2(cube, level, keep)
  return { start: cube, plan: level === 'expert' ? solveExpert(cube) : solveIntermediate(cube) }
}

// --- Intermediate practice ---

// True once intermediate step k is done (2×2 and 3×3)
export const stageDoneInt = (k: number, s: State, size: Size): boolean => (size === 2
  ? [() => stageDone(0, s, 2), () => stageDone(0, s, 2) && topYellow(s), () => isSolved(s)]
  : [() => stageDone(1, s), () => f2l(s), () => f2l(s) && topYellow(s), () => isSolved(s)])[k]()

// Setup moves from a solved cube to the start of intermediate step k: random algorithms that mix only what step k solves
export function setupInt(k: number, size: Size) {
  if (k === 0) return scramble(size === 3 ? 20 : 11)
  const pool = (size === 2 ? [OLL_CORNERS, PLL_CORNERS] : [F2L, [...OLL_EDGES, ...OLL_CORNERS], [...PLL_CORNERS, ...PLL_EDGES]])[k - 1]
  const algs = pool.map(o => o.alg).filter(a => toMoves(a).length > 2) // drop the plain U and y turns
  return Array.from({ length: size === 3 && k === 1 ? 4 : 2 }, () => `${afterY(pick(algs), (Math.random() * 4) | 0)} ${pick(['U', "U'", 'U2', ''])}`).join(' ')
}
