// N×N facelet model (4×4, 5×5): N² stickers per face, URFDLB order, row-major as seen facing each face (the 3×3 frames)
import { FACES, FRAME, SCHEME, toMoves, type State, type V } from './model.ts'

// Positions use doubled coordinates so every layer is an integer: -(N-1), -(N-3), ..., N-1
export type Turn = { axis: number; layers: number[]; sine: number; amount: number }
const SIDE: Record<string, [number, number, number]> = { R: [0, 1, -1], L: [0, -1, 1], U: [1, 1, -1], D: [1, -1, 1], F: [2, 1, -1], B: [2, -1, 1] } // axis, side, clockwise sine

// Notation: R outer face; r the second layer alone; Rw / 3Rw the outer 2 / 3 layers; M E S middle slices; x y z whole cube
export function turnOf(N: number, m: string): Turn {
  const amount = m.endsWith('2') ? 2 : m.endsWith("'") ? 3 : 1
  const core = m.replace(/['2]$/, '')
  const all = Array.from({ length: N }, (_, k) => 2 * k - (N - 1))
  const rot = 'xyz'.indexOf(core)
  if (rot >= 0) { const [axis, , sine] = SIDE['RUF'[rot]]; return { axis, layers: all, sine, amount } }
  const mid = 'MES'.indexOf(core)
  if (mid >= 0) { const [axis, , sine] = SIDE['LDF'[mid]]; return { axis, layers: [0], sine, amount } }
  const [, depth, f, w] = core.match(/^(\d?)([URFDLBurfdlb])(w?)$/) ?? []
  if (!f) throw new Error('Unknown move ' + m)
  const [axis, side, sine] = SIDE[f.toUpperCase()]
  const layers = f === f.toLowerCase() ? [side * (N - 3)] : all.filter(c => c * side >= N + 1 - 2 * (w ? Number(depth || 2) : 1))
  return { axis, layers, sine, amount }
}

const rot = ([x, y, z]: V, axis: number, s: number): V =>
  axis === 0 ? [x, -s * z, s * y] : axis === 1 ? [s * z, y, -s * x] : [-s * y, s * x, z]
const apply = <T,>(s: T[], p: number[]) => p.map(i => s[i])

export type Big = { N: number; STICKERS: { face: (typeof FACES)[number]; normal: V; pos: V }[]; perm: (m: string) => number[]; move: (s: State, alg: string) => State; SOLVED: State }
const made = new Map<number, Big>()

export function bigCube(N: number): Big {
  if (made.has(N)) return made.get(N)!
  const STICKERS = FACES.flatMap(face => {
    const [normal, o, r, d] = FRAME[face]
    return Array.from({ length: N * N }, (_, i) => ({ face, normal, pos: o.map((v, k) => v * (N - 1) + (i % N) * 2 * r[k] + ((i / N) | 0) * 2 * d[k]) as V }))
  })
  const key = (p: V, n: V) => p.join() + '|' + n.join()
  const INDEX = new Map(STICKERS.map((s, i) => [key(s.pos, s.normal), i]))
  const perms = new Map<string, number[]>()
  const perm = (m: string) => {
    let p = perms.get(m)
    if (p) return p
    const { axis, layers, sine, amount } = turnOf(N, m)
    const q = STICKERS.map((_, i) => i)
    STICKERS.forEach((st, i) => { if (layers.includes(st.pos[axis])) q[INDEX.get(key(rot(st.pos, axis, sine), rot(st.normal, axis, sine)))!] = i })
    p = amount === 1 ? q : amount === 2 ? apply(q, q) : apply(apply(q, q), q)
    perms.set(m, p)
    return p
  }
  const move = (s: State, alg: string) => toMoves(alg).reduce((a, m) => apply(a, perm(m)), s)
  const SOLVED: State = STICKERS.map(s => SCHEME[s.face])
  const cube = { N, STICKERS, perm, move, SOLVED }
  made.set(N, cube)
  return cube
}

// Random scramble with outer turns and second-layer slices, never the same axis twice in a row
export function bigScramble(n = 50) {
  const out: string[] = []
  while (out.length < n) {
    const m = 'URFDLBurfdlb'[(Math.random() * 12) | 0] + ['', "'", '2'][(Math.random() * 3) | 0]
    if (m[0].toUpperCase() !== out.at(-1)?.[0].toUpperCase()) out.push(m)
  }
  return out.join(' ')
}
