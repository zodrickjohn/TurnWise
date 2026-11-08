// Expert solves: Kociemba's two-phase search for the 3×3 (about 20 moves) and the exact optimum for the 2×2
import { PIECES, SOLVED, STICKERS, move, type State } from './model.ts'
import { bigCube } from './big.ts'

const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const UD = (i: number) => STICKERS[i].face === 'U' || STICKERS[i].face === 'D'
const FB = (i: number) => STICKERS[i].face === 'F' || STICKERS[i].face === 'B'

// Pieces read from the sticker model: corners U/D sticker first then a fixed turning order; edges reference sticker first, middle-layer edges last
const CORNERS = PIECES.filter(p => p.length === 3).map(p => {
  const first = p.find(UD)!, rest = p.filter(i => i !== first), pos = STICKERS[first].pos
  return dot(cross(STICKERS[first].normal, STICKERS[rest[0]].normal), pos) > 0 ? [first, ...rest] : [first, rest[1], rest[0]]
})
const EDGES = PIECES.filter(p => p.length === 2).map(p => (UD(p[0]) || (!UD(p[1]) && FB(p[0])) ? p : [p[1], p[0]]))
  .sort((a, b) => Number(!UD(a[0])) - Number(!UD(b[0])))
const UDCOL = new Set([SOLVED[4], SOLVED[31]]) // yellow and white
const setKey = (cs: string[]) => [...cs].sort().join('')
const CORNER_ID = new Map(CORNERS.map((p, i) => [setKey(p.map(k => SOLVED[k])), i]))
const EDGE_ID = new Map(EDGES.map((p, i) => [setKey(p.map(k => SOLVED[k])), i]))

type Cubie = { cp: number[]; co: number[]; ep: number[]; eo: number[] }
// Read pieces off stickers: which piece sits in each spot, and how it is turned
export function toCubie(s: State): Cubie {
  const cp: number[] = [], co: number[] = [], ep: number[] = [], eo: number[] = []
  CORNERS.forEach(p => { const cs = p.map(k => s[k]); cp.push(CORNER_ID.get(setKey(cs))!); co.push(cs.findIndex(c => UDCOL.has(c))) })
  EDGES.forEach(p => { const cs = p.map(k => s[k]), id = EDGE_ID.get(setKey(cs))!; ep.push(id); eo.push(cs[0] === SOLVED[EDGES[id][0]] ? 0 : 1) })
  return { cp, co, ep, eo }
}

// The effect of each move on pieces, read from the sticker model; composing applies `m` after `c`
const MOVES = ['U', 'U2', "U'", 'R', 'R2', "R'", 'F', 'F2', "F'", 'D', 'D2', "D'", 'L', 'L2', "L'", 'B', 'B2', "B'"]
const MOVE_CUBIE = MOVES.map(m => toCubie(move(SOLVED, m)))
const mul = (c: Cubie, m: Cubie): Cubie => ({
  cp: m.cp.map(i => c.cp[i]), co: m.cp.map((i, k) => (c.co[i] + m.co[k]) % 3),
  ep: m.ep.map(i => c.ep[i]), eo: m.ep.map((i, k) => (c.eo[i] + m.eo[k]) % 2),
})
const ID: Cubie = { cp: [...Array(8).keys()], co: Array(8).fill(0), ep: [...Array(12).keys()], eo: Array(12).fill(0) }

// Coordinates
const fact = [1, 1, 2, 6, 24, 120, 720, 5040, 40320]
const permRank = (p: number[]) => { let r = 0; for (let i = 0; i < p.length; i++) { let less = 0; for (let j = i + 1; j < p.length; j++) if (p[j] < p[i]) less++; r += less * fact[p.length - 1 - i] } return r }
const permUnrank = (r: number, n: number) => { const pool = [...Array(n).keys()], out: number[] = []; for (let i = n - 1; i >= 0; i--) { const k = Math.floor(r / fact[i]); r %= fact[i]; out.push(pool.splice(k, 1)[0]) } return out }
const SLICE_SETS: number[] = []
for (let m = 0; m < 4096; m++) if (m.toString(2).split('1').length - 1 === 4) SLICE_SETS.push(m)
const SLICE_RANK = new Map(SLICE_SETS.map((m, i) => [m, i]))
const twist = (c: Cubie) => c.co.slice(0, 7).reduce((t, v) => t * 3 + v, 0)
const flip = (c: Cubie) => c.eo.slice(0, 11).reduce((t, v) => t * 2 + v, 0)
const slice = (c: Cubie) => SLICE_RANK.get(c.ep.reduce((m, id, pos) => (id >= 8 ? m | (1 << pos) : m), 0))!
const SLICE_DONE = SLICE_RANK.get(0b111100000000)!

// Representative cubies for each coordinate value, to build move tables
const withTwist = (t: number): Cubie => { const co = Array(8).fill(0); let s = 0; for (let i = 6; i >= 0; i--) { co[i] = t % 3; s += co[i]; t = Math.floor(t / 3) } co[7] = (3 - (s % 3)) % 3; return { ...ID, co } }
const withFlip = (f: number): Cubie => { const eo = Array(12).fill(0); let s = 0; for (let i = 10; i >= 0; i--) { eo[i] = f % 2; s += eo[i]; f = Math.floor(f / 2) } eo[11] = s % 2; return { ...ID, eo } }
const withSlice = (r: number): Cubie => { const m = SLICE_SETS[r], ep: number[] = []; let a = 8, b = 0; for (let p = 0; p < 12; p++) ep.push(m & (1 << p) ? a++ : b++); return { ...ID, ep } }
const P2 = [0, 1, 2, 4, 7, 9, 10, 11, 13, 16] // U U2 U' R2 F2 D D2 D' L2 B2: the moves that keep phase 1's work

type Tables = ReturnType<typeof build>
let tables: Tables | null = null
// Move and distance tables; about a second, built once per session (in the worker)
function build() {
  const moveTable = (n: number, rep: (x: number) => Cubie, coord: (c: Cubie) => number, moves: number[]) => {
    const t = new Uint16Array(n * moves.length)
    for (let x = 0; x < n; x++) { const c = rep(x); moves.forEach((m, j) => (t[x * moves.length + j] = coord(mul(c, MOVE_CUBIE[m])))) }
    return t
  }
  const ALL = MOVES.map((_, i) => i)
  const twistM = moveTable(2187, withTwist, twist, ALL), flipM = moveTable(2048, withFlip, flip, ALL), sliceM = moveTable(495, withSlice, slice, ALL)
  const cpM = moveTable(40320, x => ({ ...ID, cp: permUnrank(x, 8) }), c => permRank(c.cp), P2)
  const epM = moveTable(40320, x => ({ ...ID, ep: [...permUnrank(x, 8), 8, 9, 10, 11] }), c => permRank(c.ep.slice(0, 8)), P2)
  const spM = moveTable(24, x => ({ ...ID, ep: [...Array(8).keys(), ...permUnrank(x, 4).map(v => v + 8)] }), c => permRank(c.ep.slice(8).map(v => v - 8)), P2)
  // Distance tables over pairs of coordinates, by breadth-first search from solved
  const prune = (na: number, nb: number, ma: Uint16Array, mb: Uint16Array, k: number, start: number) => {
    const d = new Int8Array(na * nb).fill(-1), q = new Int32Array(na * nb)
    let head = 0, tail = 0
    d[start] = 0; q[tail++] = start
    while (head < tail) {
      const x = q[head++], a = Math.floor(x / nb), b = x % nb
      for (let j = 0; j < k; j++) { const y = ma[a * k + j] * nb + mb[b * k + j]; if (d[y] < 0) { d[y] = d[x] + 1; q[tail++] = y } }
    }
    return d
  }
  return {
    twistM, flipM, sliceM, cpM, epM, spM,
    pTS: prune(2187, 495, twistM, sliceM, 18, SLICE_DONE), pFS: prune(2048, 495, flipM, sliceM, 18, SLICE_DONE),
    pCS: prune(40320, 24, cpM, spM, 10, 0), pES: prune(40320, 24, epM, spM, 10, 0),
  }
}

const face = (m: number) => Math.floor(m / 3)
// Skip a move on the same face as the last one, and order opposite faces (U then D, never D then U)
const allowed = (m: number, last: number) => last < 0 || (face(m) !== face(last) && !(face(m) % 3 === face(last) % 3 && face(m) < face(last)))

// Shortest solve found within the time budget (ms): the moves, and how many of them are phase 1
export function twoPhase(s: State, budget = 300, enough = 20): { moves: string; split: number } {
  const T = (tables ??= build())
  const start = toCubie(s), t0 = performance.now()
  let best: number[] | null = null, split = 0
  const path: number[] = []
  const phase2 = (cp: number, ep: number, sp: number, depth: number, last: number): boolean => {
    if (depth === 0) return cp === 0 && ep === 0 && sp === 0
    const h1 = T.pCS[cp * 24 + sp], h2 = T.pES[ep * 24 + sp]
    if (h1 < 0 || h2 < 0 || Math.max(h1, h2) > depth) return false // -1: unreachable (an impossible cube)
    for (let j = 0; j < 10; j++) {
      const m = P2[j]
      if (!allowed(m, last)) continue
      path.push(m)
      if (phase2(T.cpM[cp * 10 + j], T.epM[ep * 10 + j], T.spM[sp * 10 + j], depth - 1, m)) return true
      path.pop()
    }
    return false
  }
  const phase1 = (tw: number, fl: number, sl: number, depth: number, last: number): boolean => {
    if (depth === 0) {
      if (tw || fl || sl !== SLICE_DONE) return false
      if (last >= 0 && P2.includes(last) && path.length) return false // ending on a phase-2 move just duplicates a shorter split
      const c = path.reduce((x, m) => mul(x, MOVE_CUBIE[m]), start)
      const cp = permRank(c.cp), ep = permRank(c.ep.slice(0, 8)), sp = permRank(c.ep.slice(8).map(v => v - 8))
      const len1 = path.length, cap = (best ? best.length - 1 : 30) - len1
      for (let d2 = 0; d2 <= cap; d2++) if (phase2(cp, ep, sp, d2, last)) { best = [...path]; split = len1; path.length = len1; return best.length <= enough || performance.now() - t0 > budget }
      return performance.now() - t0 > budget * 4
    }
    if (Math.max(T.pTS[tw * 495 + sl], T.pFS[fl * 495 + sl]) > depth) return false
    for (let m = 0; m < 18; m++) {
      if (!allowed(m, last)) continue
      path.push(m)
      if (phase1(T.twistM[tw * 18 + m], T.flipM[fl * 18 + m], T.sliceM[sl * 18 + m], depth - 1, m)) return true
      path.pop()
    }
    return false
  }
  for (let d1 = 0; d1 <= 12; d1++) {
    if (phase1(twist(start), flip(start), slice(start), d1, -1)) break
    if (best && performance.now() - t0 > budget) break
  }
  if (!best) throw new Error('No two-phase solution found')
  return { moves: (best as number[]).map(m => MOVES[m]).join(' '), split }
}

// --- 2×2: with the bottom-left-back corner held still, U R F reach every position; an exact distance table gives the optimum ---
const DBL = CORNERS.findIndex(p => ['D', 'B', 'L'].every(f => p.some(k => STICKERS[k].face === f)))
const OTHERS = [...Array(8).keys()].filter(i => i !== DBL)
const URF = [0, 1, 2, 3, 4, 5, 6, 7, 8] // U U2 U' R R2 R' F F2 F'
const cornersOf = (s: State): Cubie => {
  const cp: number[] = [], co: number[] = []
  CORNERS.forEach(p => { const cs = p.map(k => s[k]); cp.push(CORNER_ID.get(setKey(cs))!); co.push(cs.findIndex(c => UDCOL.has(c))) })
  return { cp, co, ep: ID.ep, eo: ID.eo }
}
const perm7 = (c: Cubie) => permRank(OTHERS.map(i => OTHERS.indexOf(c.cp[i])))
const twist6 = (c: Cubie) => OTHERS.slice(0, 6).reduce((t, i) => t * 3 + c.co[i], 0)
let two: { pm: Uint16Array; tm: Uint16Array; dist: Int8Array } | null = null
function buildTwo() {
  const pm = new Uint16Array(5040 * 9), tm = new Uint16Array(729 * 9)
  for (let x = 0; x < 5040; x++) { const p = permUnrank(x, 7), cp = [...ID.cp]; OTHERS.forEach((pos, k) => (cp[pos] = OTHERS[p[k]])); URF.forEach((m, j) => (pm[x * 9 + j] = perm7(mul({ ...ID, cp }, MOVE_CUBIE[m])))) }
  for (let x = 0; x < 729; x++) {
    const co = Array(8).fill(0); let t = x, sum = 0
    for (let k = 5; k >= 0; k--) { co[OTHERS[k]] = t % 3; sum += t % 3; t = Math.floor(t / 3) }
    co[OTHERS[6]] = (3 - (sum % 3)) % 3
    URF.forEach((m, j) => (tm[x * 9 + j] = twist6(mul({ ...ID, co }, MOVE_CUBIE[m]))))
  }
  const dist = new Int8Array(5040 * 729).fill(-1), q = new Int32Array(5040 * 729)
  let head = 0, tail = 0
  dist[0] = 0; q[tail++] = 0
  while (head < tail) {
    const x = q[head++], p = Math.floor(x / 729), t = x % 729
    for (let j = 0; j < 9; j++) { const y = pm[p * 9 + j] * 729 + tm[t * 9 + j]; if (dist[y] < 0) { dist[y] = dist[x] + 1; q[tail++] = y } }
  }
  return { pm, tm, dist }
}

// The shortest 2×2 solve (never more than 11 moves); the cube must already be read with its back-left-bottom corner home
export function optimal2(s: State): string {
  const T = (two ??= buildTwo()), c = cornersOf(s)
  if (c.cp[DBL] !== DBL || c.co[DBL] !== 0) throw new Error('optimal2 needs the back-left-bottom corner in place')
  let p = perm7(c), t = twist6(c)
  const out: string[] = []
  for (let d = T.dist[p * 729 + t]; d > 0; d--) {
    const j = URF.findIndex((_, k) => T.dist[T.pm[p * 9 + k] * 729 + T.tm[t * 9 + k]] === d - 1)
    out.push(MOVES[URF[j]]); p = T.pm[p * 9 + j]; t = T.tm[t * 9 + j]
  }
  return out.join(' ')
}

// --- Four pieces at once, optimally: the white cross (4 edges) or a 2×2's white layer (4 corners); 24 slots each, 24⁴ positions ---
const setTables = new Map<string, { slot: Uint8Array; dist: Int8Array }>()
function setTable(kind: 'e' | 'c', ids: number[]) {
  const key = kind + ids.join()
  if (setTables.has(key)) return setTables.get(key)!
  const k = kind === 'e' ? 2 : 3, n = kind === 'e' ? 12 : 8
  // Where a piece in slot (position, twist) goes under each move
  const slot = new Uint8Array(24 * 18)
  MOVE_CUBIE.forEach((m, j) => {
    const perm = kind === 'e' ? m.ep : m.cp, ori = kind === 'e' ? m.eo : m.co
    for (let pos = 0; pos < n; pos++) for (let o = 0; o < k; o++) { const to = perm.indexOf(pos); slot[(pos * k + o) * 18 + j] = to * k + ((o + ori[to]) % k) }
  })
  const dist = new Int8Array(24 ** 4).fill(-1), q = new Int32Array(24 ** 4)
  const start = ids.reduce((t, id, i) => t + id * k * 24 ** i, 0)
  let head = 0, tail = 0
  dist[start] = 0; q[tail++] = start
  while (head < tail) {
    const x = q[head++]
    for (let j = 0; j < 18; j++) {
      let y = 0
      for (let i = 0; i < 4; i++) y += slot[(Math.floor(x / 24 ** i) % 24) * 18 + j] * 24 ** i
      if (dist[y] < 0) { dist[y] = dist[x] + 1; q[tail++] = y }
    }
  }
  const t = { slot, dist }
  setTables.set(key, t)
  return t
}

// Shortest moves that put the four given pieces home (the rest of the cube is ignored)
export function optimalSet(s: State, kind: 'e' | 'c', colors: string): string {
  const pieces = kind === 'e' ? EDGES : CORNERS, idMap = kind === 'e' ? EDGE_ID : CORNER_ID
  const ids = pieces.map((p, i) => [p, i] as const).filter(([p]) => p.some(k => SOLVED[k] === colors)).map(([, i]) => i)
  const T = setTable(kind, ids), k = kind === 'e' ? 2 : 3
  // Current slot of each piece
  let x = 0
  pieces.forEach((p, pos) => {
    const cs = p.map(i => s[i]), id = idMap.get(setKey(cs))
    const i = ids.indexOf(id as number)
    if (id === undefined || i < 0) return
    const o = kind === 'e' ? (cs[0] === SOLVED[EDGES[id][0]] ? 0 : 1) : cs.findIndex(c => UDCOL.has(c))
    x += (pos * k + o) * 24 ** i
  })
  const out: string[] = []
  for (let d = T.dist[x]; d > 0; d--) {
    let next = -1
    const j = MOVES.findIndex((_, jj) => { let y = 0; for (let i = 0; i < 4; i++) y += T.slot[(Math.floor(x / 24 ** i) % 24) * 18 + jj] * 24 ** i; return T.dist[y] === d - 1 && (next = y) >= 0 })
    out.push(MOVES[j]); x = next
  }
  return out.join(' ')
}

// A reduced big cube can be a 3×3 no real 3×3 could be: one edge flipped (OLL parity) or two pieces swapped (PLL parity)
const permParity = (p: number[]) => { let n = 0; for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[i] > p[j]) n++; return n % 2 }
const GRIPS = ['', 'x', "x'", 'x2', 'z', "z'"].flatMap(a => ['', 'y', "y'", 'y2'].map(b => `${a} ${b}`.trim()))
export function parities(s: State) {
  // Read in the usual grip: a whole-cube turn relabels corners and edges differently and would flip the answer
  const c = toCubie(GRIPS.map(g => bigCube(3).move(s, g)).find(x => x[4] === SOLVED[4] && x[22] === SOLVED[22]) ?? s)
  return { flip: c.eo.reduce((a, b) => a + b, 0) % 2 === 1, swap: permParity(c.cp) !== permParity(c.ep) }
}
