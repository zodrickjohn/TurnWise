// Reduction method for 4×4 and 5×5: build the centers, pair the edges, then solve it like a 3×3 (with 4×4 parity fixes)
import { bigCube, bigScramble } from './big.ts'
import { FACES, NAME, SOLVED, cornersOnly, move, scramble, simplify, toMoves, type Size, type State } from './model.ts'
import { IMPOSSIBLE, STAGES, STEPS, diagnose, normalize, practiceFrom, practiceSetup, prepare, stageDone, timeline, validate, type Chunk, type Diagnosis, type Line } from './solver.ts'

export const STAGES_BIG = [
  {
    title: 'White center',
    goal: 'Gather every white center piece onto one face. Turn the cube upside down first, so you build it on top where you can see it.',
    why: "A slice move lifts a whole column into the top, a top turn moves your piece out of that column, and undoing the slice puts everything else back. Only the top face changes for good.",
    look: 'New moves on big cubes: a lowercase letter such as r turns only the second layer in from that side, and Rw turns the face and that layer together. Find a white center piece on a side, turn that side so the piece sits in a column a slice can lift, turn the top so a spot that is not white waits in that column, then do the three moves.',
  },
  {
    title: 'Yellow center',
    goal: 'Turn the cube back over, white center on the bottom, and build the yellow center on top.',
    why: 'The same slice, top, slice-back moves never disturb the bottom face, so the white center stays finished while yellow comes together.',
    look: 'Yellow pieces can hide on any side. Bring one into a slice column under a non-yellow spot on top, lift it in, and repeat.',
  },
  {
    title: 'Side centers',
    goal: 'Build the four remaining centers so their colors sit in the right order around the cube.',
    why: 'With white and yellow held on the left and right, slices that run front-to-back never touch them. When a stubborn piece is left, an eight-move commutator swaps exactly three center pieces and nothing else.',
    look: 'Build each center on top, then roll the cube forward to start the next. The last one finishes itself once the other three are done.',
  },
  {
    title: 'Pair the edges',
    goal: 'Join the loose edge pieces into full edges, so every edge shows one color pair along its whole length.',
    why: 'Sliding the middle layer joins two matching halves at the front left. The flip move then swaps the leftover mixed edge for a fresh one from the top, and sliding back repairs the centers.',
    look: 'Find two halves with the same colors. Put one at the front left, the other at the front right at the opposite height, then slice, flip, slice back.',
  },
  ...STAGES,
]
export const BIG_LEAD = 4 // stages before the 3×3 part

const inv = (m: string) => (m.endsWith('2') ? m : m.endsWith("'") ? m.slice(0, -1) : m + "'")
const T = ['', "'", '2']
const ap = (s: State, p: number[]) => p.map(i => s[i])
const SRC_NOTE: Record<string, string> = { F: 'front', B: 'back', L: 'left', R: 'right', D: 'bottom' }

// Everything that depends only on the size, built once
const kits = new Map<number, ReturnType<typeof makeKit>>()
const kitOf = (N: number) => kits.get(N) ?? (kits.set(N, makeKit(N)), kits.get(N)!)

function makeKit(N: number) {
  const b = bigCube(N), A = N * N, mid = (N - 1) >> 1
  const centers = FACES.map((_, f) => { const o: number[] = []; for (let r = 1; r < N - 1; r++) for (let c = 1; c < N - 1; c++) o.push(f * A + r * N + c); return o })
  const isCenter = (i: number) => { const r = ((i % A) / N) | 0, c = i % N; return r > 0 && r < N - 1 && c > 0 && c < N - 1 }
  // Edge pieces grouped by edge: each piece as its two sticker indices, in face order
  const byPos = new Map<string, number[]>()
  b.STICKERS.forEach((st, i) => byPos.set(st.pos.join(), [...(byPos.get(st.pos.join()) ?? []), i]))
  const groups = new Map<string, number[][]>()
  for (const ids of byPos.values()) if (ids.length === 2) {
    const k = ids.map(i => b.STICKERS[i].face).join('')
    groups.set(k, [...(groups.get(k) ?? []), ids])
  }
  const along = (ids: number[]) => b.STICKERS[ids[0]].pos.find(v => Math.abs(v) !== N - 1) ?? 0 // position along the edge
  const edges = [...groups.values()].map(g => g.sort((x, y) => along(x) - along(y))) // in order, so a 5×5's middle piece sits in the middle
  const compose = (alg: string) => alg.split(' ').filter(Boolean).reduce((p, m) => b.perm(m).map(j => p[j]), b.STICKERS.map((_, i) => i))

  // Center inserts into the top: [setup of the source face] [top setup] slice, top, slice back (plus pure-commutator forms)
  const SLICES: [string, string][] = [['r', 'F'], ["l'", 'F'], ["r'", 'B'], ['l', 'B'], ['f', 'L'], ["b'", 'L'], ["f'", 'R'], ['b', 'R'], ['r2', 'D'], ['l2', 'D'], ['f2', 'D'], ['b2', 'D']]
  const inserts: { lines: Line[]; p: number[] }[] = []
  for (const [sl, src] of SLICES) for (const u of T) for (const pure of [false, true]) for (const a of ['', ...T.map(t => src + t)]) for (const v of ['', ...T.map(t => 'U' + t)]) {
    const ins = `${sl} U${u} ${inv(sl)}` + (pure ? ` ${inv('U' + u)}` : '')
    const lines: Line[] = []
    if (a) lines.push({ alg: a, note: `Turn the ${SRC_NOTE[src]} face so the piece lines up with the slice that will lift it.` })
    if (v) lines.push({ alg: v, note: 'Turn the top so a spot that still needs filling waits in that column.' })
    lines.push({ alg: ins, note: pure ? 'Lift it in, turn the top, slide back, and turn the top back: only three pieces move.' : 'Lift it in with the slice, turn the top, then slide the slice back.' })
    inserts.push({ lines, p: compose([a, v, ins].filter(Boolean).join(' ')) })
  }
  inserts.sort((x, y) => x.lines.length - y.lines.length)
  // Fallback: pure 3-cycles of center pieces that touch the top, [slice, face slice face'], found by trying them on a labelled cube
  let comms: typeof inserts | null = null
  const commutators = () => {
    if (comms) return comms
    comms = []
    const ID = b.STICKERS.map((_, i) => String(i))
    const SL = ['r', 'l', 'u', 'd', 'f', 'b', ...(N % 2 ? ['M', 'E', 'S'] : [])].flatMap(m => T.map(t => m + t))
    const FA = 'URFDLB'.split('').flatMap(m => T.map(t => m + t))
    for (const s of SL) for (const x of FA) for (const y of SL) {
      const alg = `${s} ${x} ${y} ${inv(x)} ${inv(s)} ${x} ${inv(y)} ${inv(x)}`
      const moved = b.move(ID, alg).flatMap((v, i) => (v !== String(i) ? [i] : []))
      if (moved.length !== 3 || !moved.every(isCenter) || !moved.some(i => i < A)) continue
      for (const v of ['', ...T.map(t => 'U' + t)]) comms.push({
        lines: [...(v ? [{ alg: v, note: 'Turn the top so the right spot lines up.' }] : []), { alg, note: 'This commutator swaps exactly three center pieces and leaves the rest of the cube alone.' }],
        p: compose(`${v} ${alg}`),
      })
    }
    return comms
  }

  // Edge pairing: [whole-cube turn] [up to two outer setup turns] slice, flip, slice back
  const undo = (alg: string) => alg.split(' ').reverse().map(inv).join(' ')
  const FLIPS = ["R U R' F R' F' R", "L' U' L F' L F L'"].flatMap(f => [f, undo(f)])
  const macros = ['u', "u'", 'd', "d'"].flatMap(sl => FLIPS.map(f => ({ alg: `${sl} ${f} ${inv(sl)}`, p: compose(`${sl} ${f} ${inv(sl)}`) })))
  // Last two edges: no free edge is left to flip in, so this one pairs both halves at the front in place
  const L2E = ['d', "d'", 'u', "u'"].flatMap(sl => ["R F' U R' F", "L' F U' L F'"].flatMap(f => [f, undo(f)]).map(f => `${sl} ${f} ${inv(sl)}`)).map(alg => ({ alg, p: compose(alg) }))
  const outer = 'URFDLB'.split('').flatMap(m => T.map(t => ({ alg: m + t, p: b.perm(m + t) })))
  // Fallback: pure 3-cycles of wing pieces, [slice, face face face'], found on a labelled cube
  let wingComms: { alg: string; p: number[] }[] | null = null
  const isWing = (i: number) => { const r = ((i % A) / N) | 0, c = i % N, m = (N - 1) / 2; return (r === 0 || r === N - 1) !== (c === 0 || c === N - 1) && r !== m && c !== m }
  const wings = () => {
    if (wingComms) return wingComms
    wingComms = []
    const ID = b.STICKERS.map((_, i) => String(i)), FA = 'URFDLB'.split('').flatMap(m => T.map(t => m + t))
    for (const a of ['r', 'l', 'u', 'd', 'f', 'b'].flatMap(m => T.map(t => m + t))) for (const x of FA) for (const y of FA) {
      if (x[0] === y[0]) continue
      const alg = `${a} ${x} ${y} ${inv(x)} ${inv(a)} ${x} ${inv(y)} ${inv(x)}`
      const moved = b.move(ID, alg).flatMap((v, i) => (v !== String(i) ? [i] : []))
      if (moved.length === 6 && moved.every(isWing)) wingComms.push({ alg, p: compose(alg) })
    }
    return wingComms
  }
  const turns = ['', 'y', "y'", 'y2'].map(alg => ({ alg, p: compose(alg) }))
  // 5×5 edge parity: the front-top edge's two wings are swapped, which no 3-cycle can undo; this swaps exactly those two
  const parity = N % 2 ? [{ alg: EDGE_PARITY, p: compose(EDGE_PARITY) }] : []
  return { b, A, mid, centers, edges, inserts, commutators, macros, L2E, wings, parity, outer, turns, compose }
}

type Kit = ReturnType<typeof makeKit>
const centerCount = (k: Kit, s: State, f: number, col: string) => k.centers[f].filter(i => s[i] === col).length
const centerDone = (k: Kit, s: State, f: number, col: string) => k.centers[f].every(i => s[i] === col)
const allCenters = (k: Kit, s: State) => k.centers.every(c => c.every(i => s[i] === s[c[0]]))
const pairedEdge = (s: State, g: number[][]) => g.every(([a, c]) => s[a] === s[g[0][0]] && s[c] === s[g[0][1]])
const pairedCount = (k: Kit, s: State) => k.edges.filter(g => pairedEdge(s, g)).length
// Progress: whole edges on a 4×4; on a 5×5 each wing that matches its edge's fixed middle piece counts (24 in all)
const middleOf = (g: number[][]) => g[(g.length - 1) >> 1]
const progress = (k: Kit, s: State) => k.b.N % 2 ? k.edges.reduce((t, g) => t + g.filter(([a, c]) => s[a] === s[middleOf(g)[0]] && s[c] === s[middleOf(g)[1]]).length - 1, 0) : pairedCount(k, s)
const edgeName = (s: State, g: number[][]) => g[0].map(i => NAME[s[i]]).join('-')

// Fill the top center with `col` while faces in `keep` (face index, color) stay finished
function buildTop(k: Kit, s: State, col: string, keep: [number, string][]): [State, Line[]] {
  const lines: Line[] = []
  for (let n; (n = centerCount(k, s, 0, col)) < k.centers[0].length;) {
    const ok = (x: State) => centerCount(k, x, 0, col) > n && keep.every(([f, c]) => centerDone(k, x, f, c))
    const hit = k.inserts.find(c => ok(ap(s, c.p))) ?? k.commutators().find(c => ok(ap(s, c.p)))
    if (!hit) throw new Error(IMPOSSIBLE)
    s = ap(s, hit.p)
    lines.push(...hit.lines)
  }
  return [s, lines]
}

// Pair one more edge at a time; the slice-flip-slice keeps centers and finished edges intact
function pairEdges(k: Kit, s: State): [State, Chunk[]] {
  const chunks: Chunk[] = []
  const goal = k.b.N % 2 ? 24 : 12
  let parityDone = false
  for (let n; (n = progress(k, s)) < goal;) {
    const hit: { best?: { s: State; algs: string[] } } = {} // a holder: the search below fills it
    const len = (algs: string[]) => algs.reduce((t, a) => t + (a ? a.split(' ').length : 0), 0)
    const macros = n >= goal - 4 ? [...k.macros, ...k.L2E] : k.macros
    // [whole-cube turn] [setup turns, up to `max`] [finisher]; keep the shortest that pairs one more edge
    const dfs = (x: State, setups: string[], max: number, turnAlg: string, finishers: { alg: string; p: number[] }[]) => {
      for (const m of finishers) {
        const algs = [turnAlg, setups.join(' '), m.alg]
        if (hit.best && len(algs) >= len(hit.best.algs)) continue
        const y = ap(x, m.p)
        if (progress(k, y) > n && allCenters(k, y)) hit.best = { s: y, algs }
      }
      if (setups.length < max) for (const o of k.outer) if (o.alg[0] !== setups.at(-1)?.[0]) dfs(ap(x, o.p), [...setups, o.alg], max, turnAlg, finishers)
    }
    // Slice-flip-slice first (what people learn); a wing 3-cycle when it would only trade one pair for another
    const steps: [number, { alg: string; p: number[] }[]][] = [[2, macros], [1, k.wings()], [3, macros], [2, k.wings()]]
    for (const [max, finishers] of steps) {
      for (const t of k.turns) dfs(ap(s, t.p), [], max, t.alg, finishers)
      if (hit.best) break
    }
    // 5×5 edge parity: two loose wings swapped between edges is odd, so no 3-cycle reaches it. Swap the front-top edge's
    // wings once (a loose edge brought there first); everything left is then even and the usual moves finish it
    if (!hit.best && k.parity.length && !parityDone) {
      const UF = k.edges.find(g => k.b.STICKERS[g[0][0]].face === 'U' && k.b.STICKERS[g[0][1]].face === 'F')!
      const loose = (x: State) => UF.some(([a, c]) => x[a] !== x[middleOf(UF)[0]] || x[c] !== x[middleOf(UF)[1]])
      const set = ['', ...k.outer.map(o => o.alg)].flatMap(a => ['', ...k.outer.map(o => o.alg)].map(c => `${a} ${c}`.trim())).find(x => loose(k.b.move(s, x)))
      if (set !== undefined) {
        const alg = `${set} ${EDGE_PARITY}`.trim()
        chunks.push({ title: 'Fix edge parity', lines: [...(set ? [{ alg: set, note: 'Bring a loose edge to the front of the top.' }] : []), { alg: EDGE_PARITY, note: 'Edge parity, a big-cube quirk: two edge halves are swapped in a way the usual moves cannot reach. This swaps the two halves of the front-top edge and nothing else.' }] })
        s = k.b.move(s, alg)
        parityDone = true
        continue
      }
    }
    const best = hit.best
    if (!best) throw new Error(IMPOSSIBLE)
    const before = new Set(k.edges.filter(g => pairedEdge(s, g)).map(g => edgeName(s, g)))
    const made = k.edges.filter(g => pairedEdge(best.s, g)).map(g => edgeName(best.s, g)).filter(x => !before.has(x))
    const [t, set, m] = best.algs, lines: Line[] = []
    if (t) lines.push({ alg: t, note: 'Turn the whole cube to bring the two halves to the front.' })
    if (set) lines.push({ alg: set, note: 'Line up the halves: one at the front left, its partner at the front right at the other height.' })
    lines.push({ alg: m, note: m === EDGE_PARITY ? 'Edge parity: the two halves of this edge are swapped, which only happens on big cubes. This swaps them and touches nothing else.' : k.wings().some(w => w.alg === m) ? 'This commutator swaps exactly three edge halves and leaves everything else alone.' : 'Slice to join them, flip a fresh edge into the front right, then slice back to fix the centers.' })
    chunks.push({ title: `Pair the ${made[0] ?? 'next'} edge`, lines })
    s = best.s
  }
  return [s, chunks]
}

// The big cube read as a 3×3: corners, one sticker per edge, the middle of each center
const reduce = (k: Kit, s: State): State => FACES.flatMap((_, f) => [0, 1, 2].flatMap(r => [0, 1, 2].map(c => s[f * k.A + [0, k.mid, k.b.N - 1][r] * k.b.N + [0, k.mid, k.b.N - 1][c]])))
const algsOf = (chunks: Chunk[]) => chunks.flatMap(ch => ch.lines.map(l => l.alg)).join(' ')
const EDGE_PARITY = "r2 B2 U2 l U2 r' U2 r U2 F2 r F2 l' B2 r2"
const OLL_PARITY = "Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'"
const PLL_PARITY = "r2 U2 r2 Uw2 r2 Uw2"

// Solve a 4×4 or 5×5 by reduction; one list of chunks per stage of STAGES_BIG
export function solveBig(start: State, N: number): Chunk[][] {
  const k = kitOf(N), b = k.b, frame = bigCube(3)
  let s = start, f3 = frame.SOLVED
  const out: Chunk[][] = []
  const turn = (alg: string) => { s = b.move(s, alg); f3 = frame.move(f3, alg) }
  const color = (face: number) => f3[face * 9 + 4] // the color each face should get, tracked through whole-cube turns
  const centerStage = (lead: Line[], keepFaces: number[], extra: { rot: string; note: string }[]) => {
    const chunks: Chunk[] = []
    lead.forEach(l => turn(l.alg))
    const [n0, lines0] = buildTop(k, s, color(0), keepFaces.map(f => [f, color(f)]))
    s = n0
    chunks.push({ title: `Build the ${NAME[color(0)]} center`, lines: [...lead, ...lines0] })
    for (const e of extra) {
      turn(e.rot)
      const keep = [1, 2, 3, 4, 5].filter(f => centerDone(k, s, f, color(f)) && f !== 2) // the front is never kept: inserts pass through it
      const [n1, lines1] = buildTop(k, s, color(0), keep.map(f => [f, color(f)]))
      s = n1
      chunks.push({ title: `Build the ${NAME[color(0)]} center`, lines: [{ alg: e.rot, note: e.note }, ...lines1] })
    }
    return chunks
  }
  out.push(centerStage([{ alg: 'x2', note: 'Turn the whole cube upside down: you will build white on top.' }], [], []))
  out.push(centerStage([{ alg: 'x2', note: 'Turn the cube back over. White goes to the bottom.' }], [3], []))
  out.push(centerStage([{ alg: 'z', note: 'Tip the cube to the right: yellow goes right, white goes left.' }], [1, 4], [
    { rot: 'x', note: 'Roll the cube forward: the center you just built goes to the back.' },
    { rot: 'x', note: 'Roll it forward again.' },
  ]))
  if (!allCenters(k, s)) throw new Error(IMPOSSIBLE)
  // Back to the usual grip: yellow on top, green in front
  const back = ['', 'x', "x'", 'x2', 'z', "z'", 'z2', 'y', "y'", 'y2'].flatMap(a => ['', 'y', "y'", 'y2'].map(c => `${a} ${c}`.trim()))
    .find(r => { const t = frame.move(f3, r); return t[4] === 'y' && t[22] === 'g' })!
  const [paired, edgeChunks] = pairEdges(k, b.move(s, back))
  f3 = frame.move(f3, back); s = paired
  if (back) edgeChunks.unshift({ title: 'Back to the usual grip', lines: [{ alg: back, note: 'Turn the whole cube so yellow is on top and green faces you.' }] })
  out.push(edgeChunks)

  // The 3×3 part, step by step on the reduced cube; a 4×4 can need an edge flip (OLL parity) or swap (PLL parity)
  for (let step = 0; step < STEPS.length; step++) {
    const chunks: Chunk[] = []
    const run = () => { const [, c] = STEPS[step](reduce(k, s)); chunks.push(...c); s = b.move(s, algsOf(c)) }
    if (N % 2 === 0 && step === 4) {
      try { STEPS[4](reduce(k, s)) } catch {
        chunks.push({ title: 'Fix the flipped edge (OLL parity)', lines: [{ alg: OLL_PARITY, note: 'Only on even cubes: one top edge is flipped in a way no 3×3 move can fix. This flips it back and leaves the bottom two layers alone.' }] })
        s = b.move(s, OLL_PARITY)
      }
    }
    if (N % 2 === 0 && step === 5) {
      try { let x = reduce(k, s); for (const f of STEPS.slice(5)) x = f(x)[0] } catch { // the rest of the 3×3 can't finish: swap first
        chunks.push({ title: 'Swap two top edges (PLL parity)', lines: [{ alg: PLL_PARITY, note: 'Only on even cubes: two top edges are swapped in a way no 3×3 move can fix. This swaps them and leaves the bottom two layers alone.' }] })
        s = b.move(s, PLL_PARITY)
      }
    }
    run()
    out.push(chunks)
  }
  if (!s.every((c, i) => c === s[Math.floor(i / k.A) * k.A + k.mid * N + k.mid])) throw new Error(IMPOSSIBLE)
  return out
}

// Friendly check before a big solve: every sticker painted, N² of each color, every corner real and unique
export function validateBig(s: State, N: number): string | null {
  const blank = s.filter(c => c === '_').length
  if (blank) return `${blank} sticker${blank > 1 ? 's are' : ' is'} still blank. Paint every sticker to continue.`
  const off = Object.keys(NAME).filter(c => s.filter(x => x === c).length !== N * N)
  if (off.length) return `Each color should appear ${N * N} times. Check ${off.map(c => `${NAME[c]} (${s.filter(x => x === c).length})`).join(', ')}.`
  const b = bigCube(N), byPos = new Map<string, number[]>()
  b.STICKERS.forEach((st, i) => byPos.set(st.pos.join(), [...(byPos.get(st.pos.join()) ?? []), i]))
  const corners = [...byPos.values()].filter(p => p.length === 3), name = (p: number[], x: State) => p.map(i => x[i]).sort().join('')
  const real = new Set(corners.map(p => name(p, b.SOLVED))), seen = new Set<string>()
  for (const p of corners) {
    const n = name(p, s)
    if (!real.has(n) || seen.has(n)) return `A corner shows ${p.map(i => NAME[s[i]]).join(', ')}, which ${seen.has(n) ? 'appears twice' : "doesn't exist"}. Check that corner's stickers.`
    seen.add(n)
  }
  return null
}

// Any size: plan a solve from painted colors (2×2 and 3×3 here; 4×4 and 5×5 by reduction)
export const prepareAny = (cube: State, size: Size) => (size > 3 ? { start: cube, plan: solveBig(cube, size) } : prepare(cube, size))
export const validateAny = (s: State, size: Size) => (size > 3 ? validateBig(s, size) : validate(s, size))

// --- Practice and the mistake detective for every size. Big cubes run these in the worker ---

const turnOf = (size: Size) => (size > 3 ? bigCube(size).move : move)
const algs = (chunks: Chunk[]) => chunks.flatMap(ch => ch.lines.map(l => l.alg)).join(' ')

// True once step k is done; big cubes check centers and edges, then their 3×3 steps on the reduced cube
export function stageDoneAny(k: number, s: State, size: Size): boolean {
  if (size <= 3) return stageDone(k, s, size)
  const kit = kitOf(size), full = (col: string) => kit.centers.some((c, f) => centerDone(kit, s, f, col))
  const edges = () => progress(kit, s) === (size % 2 ? 24 : 12)
  if (k === 0) return full('w')
  if (k === 1) return full('w') && full('y')
  if (k === 2) return allCenters(kit, s)
  if (k === 3) return allCenters(kit, s) && edges()
  return allCenters(kit, s) && edges() && stageDone(k - BIG_LEAD, reduce(kit, s))
}

const pick = <T,>(xs: T[]) => xs[(Math.random() * xs.length) | 0]
// Setup moves from a solved big cube to the start of step k: each mixes only what step k builds
function bigSetup(k: number, N: number) {
  const T3 = ['', "'", '2']
  if (k === 0) return bigScramble()
  if (k === 1) return Array.from({ length: 8 }, () => { const sl = pick(['r', "l'", "r'", 'l', 'f', "b'", "f'", 'b']); return `${sl} U${pick(T3)} ${inv(sl)} ${pick(['F', 'R', 'B', 'L'])}${pick(T3)}` }).join(' ') // slice, top, slice back: the bottom center never moves
  if (k === 2) return Array.from({ length: 10 }, () => `${pick(['u', 'd'])}${pick(T3)} ${pick(['F', 'R', 'B', 'L'])}${pick(T3)}`).join(' ') // top and bottom centers stay put
  if (k === 3) return Array.from({ length: 3 }, () => `${pick(kitOf(N).macros).alg} ${pick(['U', 'D', 'F', 'R'])}${pick(T3)}`).join(' ') // centers stay solved
  return practiceSetup(k - BIG_LEAD).setup // the 3×3 steps use outer turns only, which keep a reduced cube reduced
}

// Each task returns plain data, so the same code runs here or in the worker
export type Task =
  | { kind: 'plan'; cube: State; size: Size }
  | { kind: 'challenge'; step: number; size: Size }
  | { kind: 'setup'; step: number; size: Size }
  | { kind: 'from'; cube: State; step: number; size: Size }
  | { kind: 'chunks'; cube: State; step: number; size: Size }
  | { kind: 'diagnose'; start: State; plan: Chunk[][]; pos: number; actual: State; size: Size }

export function runTask(t: Task): unknown {
  const size = t.size
  if (t.kind === 'plan') return prepareAny(t.cube, size)
  // A cube at the start of step k: scramble, run the guide's earlier steps, and use its move count for step k as par
  if (t.kind === 'challenge') for (;;) {
    const raw = size > 3 ? bigCube(size).move(bigCube(size).SOLVED, bigScramble()) : move(SOLVED, scramble())
    const { start: s0, plan } = prepareAny(size === 2 ? cornersOnly(raw) : raw, size)
    const start = plan.slice(0, t.step).reduce((s, p) => turnOf(size)(s, algs(p)), s0), par = toMoves(algs(plan[t.step])).length
    if (par && !stageDoneAny(t.step, start, size)) return { start, par }
  }
  if (t.kind === 'setup') {
    if (size <= 3) return practiceSetup(t.step, size)
    const b = bigCube(size)
    for (let tries = 0; tries < 50; tries++) {
      const setup = simplify(bigSetup(t.step, size)), start = b.move(b.SOLVED, setup)
      if (stageDoneAny(t.step, start, size) || (t.step > 0 && !stageDoneAny(t.step - 1, start, size))) continue
      const par = toMoves(algs(solveBig(start, size)[t.step])).length
      if (par) return { setup, start, par }
    }
    throw new Error('No practice setup found')
  }
  if (t.kind === 'from') {
    if (size === 3) return practiceFrom(t.cube, t.step)
    const { start: s0, plan } = prepareAny(t.cube, size)
    const setup = algs(plan.slice(0, t.step).flat()), start = turnOf(size)(s0, setup)
    return { setup, start, par: toMoves(algs(plan[t.step])).length }
  }
  // Hints for the cube as it is now: the guide's moves for this step, or null when an earlier step came undone
  if (t.kind === 'chunks') return t.step > 0 && !stageDoneAny(t.step - 1, t.cube, size) ? null : prepareAny(t.cube, size).plan[t.step]
  // Mistake detective: big cubes compare in every grip, since nothing fixes which way the cube is held
  const { states } = timeline(t.start, t.plan, size)
  if (size <= 3) return diagnose(states, t.pos, t.actual, size)
  return diagnoseBig(states, t.pos, t.actual, size)
}

const GRIPS = ['', 'x', "x'", 'x2', 'z', "z'"].flatMap(a => ['', 'y', "y'", 'y2'].map(b => `${a} ${b}`.trim()))
function diagnoseBig(states: State[], pos: number, actual: State, N: number): Diagnosis {
  const b = bigCube(N), key = (s: State) => GRIPS.map(g => b.move(s, g).join('')).sort()[0]
  const target = key(actual)
  const near = states.map((_, p) => p).sort((x, y) => Math.abs(x - pos) - Math.abs(y - pos))
  for (const p of near) if (key(states[p]) === target) return { kind: p === pos ? 'same' : 'jump', at: p }
  const SINGLE = ['U', 'R', 'F', 'D', 'L', 'B', 'u', 'r', 'f', 'd', 'l', 'b'].flatMap(f => [f, f + "'", f + '2'])
  for (const p of near.slice(0, 40)) for (const m of SINGLE) if (key(b.move(states[p], m)) === target) return { kind: 'slip', at: p, wrong: m }
  return { kind: 'new', at: 0 }
}

// Turn a big cube to the usual grip (yellow on top, green in front) once its centers say which way that is
export function normalizeAny(s: State, size: Size): State {
  if (size <= 3) return size === 3 ? normalize(s) : s
  const b = bigCube(size), c = (x: State, f: number) => x[f * size * size + ((size - 1) >> 1) * (size + 1)]
  return GRIPS.map(g => b.move(s, g)).find(x => c(x, 0) === 'y' && c(x, 2) === 'g') ?? s
}
