import { NAME, PIECES, STICKERS, home, isSolved, move, toMoves, type State } from './model.ts'

export type Line = { alg: string; note: string }
export type Chunk = { title: string; lines: Line[] }
type Opt = Line & { fam?: string }
type Pred = (s: State, p: number[]) => boolean

// Teaching content for the 8 steps of the beginner's method
export const STAGES = [
  {
    title: 'The daisy',
    goal: 'Put the four white edges around the yellow center, white facing up, like petals on a flower.',
    why: 'Edges are easiest to move while they sit on top, because there is nothing built yet that you could knock loose. Gathering them first turns the cross into four simple drops.',
    look: 'Find a white sticker on an edge piece (the pieces with two colors). Ask which face could carry it up to the top. Before turning that face, spin the top so a petal you already placed is not in the way.',
  },
  {
    title: 'The white cross',
    goal: 'Drop each petal to the bottom so you get a white cross whose side colors match the side centers.',
    why: 'Centers never move relative to each other, so they tell you where every piece belongs. Lining a petal up with its center before dropping it guarantees it lands in the right place.',
    look: 'Look at the side sticker of a petal, not the white one. Spin the top until it sits above the center of the same color, then turn that face twice.',
  },
  {
    title: 'White corners',
    goal: 'Fill the four bottom corners so the whole white face is done and each side shows a small T.',
    why: "R U R' U' lifts the front-right slot, lets the corner swap in, and puts the slot back. Each round twists the corner a third of a turn, so after at most five rounds it drops in the right way round.",
    look: 'Find a top-layer corner with white on it. Its other two colors name its home: the slot between the two centers of those colors. Park it above that slot, hold the slot at front-right, and repeat the trigger.',
  },
  {
    title: 'Middle layer',
    goal: 'Insert the four middle edges so the bottom two layers are complete.',
    why: 'These algorithms take the slot out, pair it with the edge waiting on top, and put both back together. The white layer ends up exactly where it started.',
    look: 'Find a top edge with no yellow on it. Turn the top until its front sticker matches the front center, making an upside-down T. Its top sticker tells you the direction: right center means go right, left center means go left. An edge stuck in the wrong slot? Run either algorithm once to pop it out.',
  },
  {
    title: 'Yellow cross',
    goal: 'Make a yellow cross on top. Ignore the corners for now.',
    why: "F R U R' U' F' flips two top edges at a time without touching the finished layers. You will see a dot, then an L, then a line, then the cross.",
    look: 'Look only at the edge stickers of the top face. Hold an L so it points to the back and the left, like a clock at 9 and 12. Hold a line horizontally. Then do the algorithm.',
  },
  {
    title: 'Yellow edges',
    goal: 'Match the side stickers of the four top edges with their centers.',
    why: "R U R' U R U2 R' U swaps two neighbouring top edges and leaves the rest of the cross in place.",
    look: 'Turn the top until at least two edges match their centers. If the two matched edges are neighbours, hold them at the back and right. If they are opposite each other, do the algorithm once from anywhere and look again.',
  },
  {
    title: 'Place yellow corners',
    goal: 'Move each yellow corner to its own spot, even if it is still twisted.',
    why: "U R U' L' U R' U' L keeps the front-right corner still and cycles the other three. One correct corner is all the anchor you need.",
    look: 'A corner is in its spot when its three colors match the three centers around it, in any rotation. Hold a correct one at front-right. If none are correct, do the algorithm once and look again.',
  },
  {
    title: 'Twist yellow corners',
    goal: 'Twist each corner until yellow faces up. The cube is then solved.',
    why: "R' D' R D twists the front-right corner. The lower layers look scrambled while you work, but once every corner is twisted correctly they fall back into place.",
    look: 'Keep yellow on top and never turn the whole cube during this step. Fix the front-right corner, then turn only the top layer to bring the next unfinished corner to front-right.',
  },
]

export const IMPOSSIBLE = "These colors describe a cube that can't exist. Usually two stickers are swapped, or a corner is twisted in place. Check each face against your cube."

const ORDER = 'wyrogb'
const pieceName = (s: State, p: number[]) => p.map(i => s[i]).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).map(c => NAME[c]).join('-') + (p.length === 2 ? ' edge' : ' corner')
const layer = (p: number[]) => STICKERS[p[0]].pos[1]
const placed: Pred = (s, p) => p.every(i => s[i] === home(s, i))
const EDGES = PIECES.filter(p => p.length === 2)
const CORNERS = PIECES.filter(p => p.length === 3)
const count = (s: State, pred: Pred) => PIECES.filter(p => pred(s, p)).length
const f2l = (s: State) => PIECES.every(p => layer(p) === 1 || placed(s, p))
const topEdges = EDGES.filter(p => layer(p) === 1)

// Shortest sequence of options reaching goal (iterative deepening; skips repeating a family like U then U')
function search(s: State, opts: Opt[], goal: (s: State) => boolean, max: number) {
  const path: Opt[] = []
  const dfs = (s: State, d: number, fam?: string): boolean => {
    if (goal(s)) return true
    if (!d) return false
    for (const o of opts) {
      if (o.fam && o.fam === fam) continue
      path.push(o)
      if (dfs(move(s, o.alg), d - 1, o.fam)) return true
      path.pop()
    }
    return false
  }
  for (let d = 0; d <= max; d++) if (dfs(s, d)) return path.map(({ alg, note }) => ({ alg, note }))
  throw new Error(IMPOSSIBLE)
}

const fam = (f: string, note: string, algs: string[]): Opt[] => algs.map(alg => ({ alg, note, fam: f }))
const turns = (f: string, note: string) => fam(f, note, [f, f + "'", f + '2'])
const reps = (alg: string, n: number) => Array(n).fill(alg).join(' ')

// Add pieces matching pred one at a time until all four are done
function place(s: State, opts: Opt[], pred: Pred, max: number, title: (piece: string) => string, keep = (_: State) => true): [State, Chunk[]] {
  const chunks: Chunk[] = []
  for (let n; (n = count(s, pred)) < 4; ) {
    const before = new Set(PIECES.filter(p => pred(s, p)).map(p => pieceName(s, p)))
    const lines = search(s, opts, x => count(x, pred) > n && keep(x), max)
    s = lines.reduce((a, l) => move(a, l.alg), s)
    const added = PIECES.filter(p => pred(s, p)).map(p => pieceName(s, p)).filter(k => !before.has(k))
    chunks.push({ title: title(added.join(' and ')), lines })
  }
  return [s, chunks]
}

function whole(s: State, opts: Opt[], goal: (s: State) => boolean, max: number, title: string): [State, Chunk[]] {
  if (goal(s)) return [s, []]
  const lines = search(s, opts, goal, max)
  return [lines.reduce((a, l) => move(a, l.alg), s), [{ title, lines }]]
}

const FACE_NAME: Record<string, string> = { R: 'right', L: 'left', F: 'front', B: 'back', D: 'bottom', U: 'top' }
const DAISY: Opt[] = [...'URFDLB'].flatMap(f =>
  turns(f, f === 'U' ? 'Spin the top so an empty spot waits where the white edge will arrive.'
    : f === 'D' ? 'Turn the bottom to slide the white edge under an empty spot.'
    : `Turn the ${FACE_NAME[f]} face to carry the white edge up next to the yellow center.`))

const CROSS: Opt[] = [
  ...turns('U', "Spin the top until a petal's side color sits above the matching center."),
  ...turns('y', 'Turn the whole cube so that matched petal faces you.'),
  { alg: 'F2', note: 'Turn the front face twice. The edge drops to the bottom, white side down.' },
]

const TRIGGER = "R U R' U'"
const CORNER_OPTS: Opt[] = [
  ...turns('U', 'Turn the top to park the white corner right above its home slot.'),
  ...turns('y', 'Turn the whole cube so the home slot is at front-right.'),
  ...[1, 2, 3, 4, 5].map(n => ({ alg: reps(TRIGGER, n), fam: 'T', note: n === 1 ? `Do ${TRIGGER} once.` : `Repeat ${TRIGGER} ${n} times, until the corner sits home with white facing down.` })),
]

const MIDDLE: Opt[] = [
  ...turns('U', 'Turn the top until the edge\'s front sticker matches the front center (an upside-down T).'),
  ...turns('y', 'Turn the whole cube so the edge you are working on faces you.'),
  { alg: "U R U' R' U' F' U F", note: 'Send the front-top edge down to the right.' },
  { alg: "U' L' U L U F U' F'", note: 'Send the front-top edge down to the left.' },
]

const YCROSS: Opt[] = [
  ...turns('U', 'Turn the top so the yellow L points back-left, or the line runs left to right.'),
  { alg: "F R U R' U' F'", note: 'Flip two top edges to grow the yellow shape.' },
]

const YEDGES: Opt[] = [
  ...turns('U', 'Turn the top so edges line up with their centers.'),
  ...turns('y', 'Turn the whole cube so the matched pair sits at the back and right.'),
  { alg: "R U R' U R U2 R' U", note: 'Swap the front and left top edges.' },
]

const PLACE_ALG = "U R U' L' U R' U' L"
const YCORNERS: Opt[] = [
  ...turns('y', 'Turn the whole cube so a corner already in its spot sits at front-right.'),
  { alg: PLACE_ALG, fam: 'A', note: 'Cycle the other three corners while front-right stays put.' },
  { alg: reps(PLACE_ALG, 2), fam: 'A', note: 'Run it twice to cycle the other three corners the other way.' },
]

// Final step is a fixed routine: twist front-right until yellow is up, then turn U to the next corner
function twistCorners(s: State): [State, Chunk[]] {
  const lines: Line[] = []
  const AUF = ['', 'U', 'U2', "U'"]
  for (let i = 0; [0, 2, 6, 8].some(k => s[k] !== s[4]) && i < 4; i++) {
    const u = AUF.find(u => move(s, u)[8] !== s[4])!
    if (u) lines.push({ alg: u, note: 'Turn only the top layer to bring the next corner that is not yellow-up to front-right.' })
    s = move(s, u)
    let n = 0
    while (s[8] !== s[4] && n < 3) (s = move(s, reps("R' D' R D", 2))), n++
    if (n === 3) throw new Error(IMPOSSIBLE)
    lines.push({ alg: reps("R' D' R D", 2 * n), note: `Repeat R' D' R D ${2 * n} times until yellow faces up. The lower layers scramble for now; that is expected.` })
  }
  const u = AUF.find(u => isSolved(move(s, u)))
  if (u === undefined) throw new Error(IMPOSSIBLE)
  if (u) lines.push({ alg: u, note: 'Turn the top to line everything up. Solved!' })
  return [move(s, u), lines.length ? [{ title: 'Twist each corner yellow-up', lines }] : []]
}

const petal: Pred = (s, p) => p.length === 2 && p.some(i => STICKERS[i].face === 'U' && s[i] === s[31])
const crossDone: Pred = (s, p) => p.length === 2 && layer(p) === -1 && placed(s, p)
const cornerDone: Pred = (s, p) => p.length === 3 && layer(p) === -1 && placed(s, p)
const midDone: Pred = (s, p) => p.length === 2 && layer(p) === 0 && placed(s, p)
const positioned = (s: State, p: number[]) => p.map(i => s[i]).sort().join() === p.map(i => home(s, i)).sort().join()

// Solve with the 8-step beginner's method; returns chunks of moves per stage
export function solve(start: State): Chunk[][] {
  let s = start
  const out: Chunk[][] = []
  const run = (fn: (s: State) => [State, Chunk[]]) => { const [n, c] = fn(s); s = n; out.push(c) }
  const crossReady = count(s, crossDone) === 4
  run(s => (crossReady ? [s, []] : place(s, DAISY, petal, 6, p => `Bring the ${p} up`)))
  run(s => (crossReady ? [s, []] : place(s, CROSS, crossDone, 3, p => `Drop the ${p}`)))
  run(s => place(s, CORNER_OPTS, cornerDone, 6, p => `Place the ${p}`, x => count(x, crossDone) === 4))
  run(s => place(s, MIDDLE, midDone, 6, p => `Insert the ${p}`, x => count(x, cornerDone) === 4 && count(x, crossDone) === 4))
  run(s => whole(s, YCROSS, x => f2l(x) && topEdges.every(p => p.some(i => STICKERS[i].face === 'U' && x[i] === x[4])), 6, 'Build the yellow cross'))
  run(s => whole(s, YEDGES, x => f2l(x) && topEdges.every(p => placed(x, p)), 6, 'Match the top edges'))
  run(s => whole(s, YCORNERS, x => f2l(x) && topEdges.every(p => placed(x, p)) && CORNERS.every(p => positioned(x, p)), 4, 'Move corners to their spots'))
  run(twistCorners)
  return out
}

// Friendly check before solving: every sticker painted, 9 of each color, every piece real and unique
export function validate(s: State): string | null {
  const blank = s.filter(c => c === '_').length
  if (blank) return `${blank} sticker${blank > 1 ? 's are' : ' is'} still blank. Paint every sticker to continue.`
  const off = Object.keys(NAME).filter(c => s.filter(x => x === c).length !== 9)
  if (off.length) return `Each color should appear 9 times. Check ${off.map(c => `${NAME[c]} (${s.filter(x => x === c).length})`).join(', ')}.`
  const real = new Set(PIECES.map(p => pieceName(s.map((_, i) => home(s, i)), p)))
  const seen = new Set<string>()
  for (const p of PIECES) {
    const n = pieceName(s, p)
    if (!real.has(n)) return `There's a piece showing ${n.replace(/ (edge|corner)$/, '')}, and no such piece exists. Check the ${p.map(i => FACE_NAME[STICKERS[i].face]).join(', ')} faces.`
    if (seen.has(n)) return `The ${n} appears twice. One of its stickers is painted the wrong color.`
    seen.add(n)
  }
  return null
}

export type TimedMove = { stage: number; chunk: number; line: number; m: string }

// Every move of a plan in order, tagged with where it sits, plus the cube state before each move (and after the last)
export function timeline(start: State, plan: Chunk[][]) {
  const moves: TimedMove[] = []
  plan.forEach((chunks, stage) => chunks.forEach((ch, chunk) => ch.lines.forEach((l, line) => toMoves(l.alg).forEach(m => moves.push({ stage, chunk, line, m })))))
  const states = [start]
  moves.forEach(t => states.push(move(states.at(-1)!, t.m)))
  return { moves, states }
}

// True once step k (0-7) of the method is complete on this cube
export function stageDone(k: number, s: State) {
  const bottom = count(s, crossDone) === 4 && count(s, cornerDone) === 4
  return [
    () => count(s, petal) === 4 || count(s, crossDone) === 4,
    () => count(s, crossDone) === 4,
    () => bottom,
    () => f2l(s),
    () => f2l(s) && topEdges.every(p => p.some(i => STICKERS[i].face === 'U' && s[i] === s[4])),
    () => f2l(s) && topEdges.every(p => placed(s, p)),
    () => f2l(s) && topEdges.every(p => placed(s, p)) && CORNERS.every(p => positioned(s, p)),
    () => isSolved(s),
  ][k]()
}

// Turn the whole cube (y) until green faces front, the way cubes are entered on the paint screen
export function normalize(s: State) {
  for (let k = 0; k < 4 && s[22] !== 'g'; k++) s = move(s, 'y')
  return s
}

const SINGLE = [...'URFDLB'].flatMap(f => [f, f + "'", f + '2'])
export type Diagnosis = { kind: 'same' | 'jump' | 'slip' | 'new'; at: number; wrong?: string }

// Mistake detective: find the solve position the real cube matches, or that plus one stray turn
export function diagnose(states: State[], pos: number, actual: State): Diagnosis {
  const key = actual.join('')
  const same = (s: State) => normalize(s).join('') === key
  const near = states.map((_, p) => p).sort((a, b) => Math.abs(a - pos) - Math.abs(b - pos))
  for (const p of near) if (same(states[p])) return { kind: p === pos ? 'same' : 'jump', at: p }
  for (const p of near) for (const m of SINGLE) if (same(move(states[p], m))) return { kind: 'slip', at: p, wrong: m }
  return { kind: 'new', at: 0 }
}
