// Facelet cube model: 54 stickers, faces in URFDLB order, row-major as seen facing each face
export type State = string[]
export type V = [number, number, number]
export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const
export type Face = (typeof FACES)[number]

// Per face: [normal, top-left sticker position, step right, step down] (x right, y up, z toward viewer)
export const FRAME: Record<Face, [V, V, V, V]> = {
  U: [[0, 1, 0], [-1, 1, -1], [1, 0, 0], [0, 0, 1]],
  R: [[1, 0, 0], [1, 1, 1], [0, 0, -1], [0, -1, 0]],
  F: [[0, 0, 1], [-1, 1, 1], [1, 0, 0], [0, -1, 0]],
  D: [[0, -1, 0], [-1, -1, 1], [1, 0, 0], [0, 0, -1]],
  L: [[-1, 0, 0], [-1, 1, -1], [0, 0, 1], [0, -1, 0]],
  B: [[0, 0, -1], [1, 1, -1], [-1, 0, 0], [0, -1, 0]],
}

export const STICKERS = FACES.flatMap(face => {
  const [normal, o, r, d] = FRAME[face]
  return Array.from({ length: 9 }, (_, i) => ({ face, normal, pos: o.map((v, k) => v + (i % 3) * r[k] + ((i / 3) | 0) * d[k]) as V }))
})

const key = (p: V, n: V) => p.join() + '|' + n.join()
const INDEX = new Map(STICKERS.map((s, i) => [key(s.pos, s.normal), i]))

// Quarter turn of v about axis (0=x,1=y,2=z) with sine s (±1)
const rot = ([x, y, z]: V, axis: number, s: number): V =>
  axis === 0 ? [x, -s * z, s * y] : axis === 1 ? [s * z, y, -s * x] : [-s * y, s * x, z]

// Clockwise quarter turn per move letter: [axis, layer (null = whole cube), sine]
export const BASE: Record<string, [number, number | null, number]> = {
  U: [1, 1, -1], D: [1, -1, 1], R: [0, 1, -1], L: [0, -1, 1], F: [2, 1, -1], B: [2, -1, 1], y: [1, null, -1],
}

const apply = <T>(s: T[], p: number[]) => p.map(i => s[i])
const PERM: Record<string, number[]> = {}
for (const [m, [axis, layer, s]] of Object.entries(BASE)) {
  const p = STICKERS.map((_, i) => i)
  STICKERS.forEach((st, i) => {
    if (layer === null || st.pos[axis] === layer) p[INDEX.get(key(rot(st.pos, axis, s), rot(st.normal, axis, s)))!] = i
  })
  PERM[m] = p
  PERM[m + '2'] = apply(p, p)
  PERM[m + "'"] = apply(PERM[m + '2'], p)
}

export const toMoves = (alg: string) => alg.split(' ').filter(Boolean)
export const move = (s: State, alg: string) => toMoves(alg).reduce((a, m) => apply(a, PERM[m]), s)
export const invertMove = (m: string) => (m.endsWith('2') ? m : m.endsWith("'") ? m[0] : m + "'")

// Colors: white, yellow, red, orange, green, blue; '_' = not painted yet
export const NAME: Record<string, string> = { w: 'white', y: 'yellow', r: 'red', o: 'orange', g: 'green', b: 'blue' }
export const SCHEME: Record<Face, string> = { U: 'y', R: 'o', F: 'g', D: 'w', L: 'r', B: 'b' }
export const SOLVED: State = STICKERS.map(s => SCHEME[s.face])
export const home = (s: State, i: number) => s[((i / 9) | 0) * 9 + 4]
export const isSolved = (s: State) => s.every((c, i) => c === '_' || c === home(s, i)) // '_' = not part of this puzzle (2x2 edges)
export type Size = 2 | 3 | 4 | 5
// A 2x2 is the 8 corners of a 3x3: same moves, edges blank; centers are an invisible frame the solver picks
export const isCorner = (i: number) => [0, 2, 6, 8].includes(i % 9)
export const cornersOnly = (s: State) => s.map((c, i) => (isCorner(i) ? c : '_'))

// Edge and corner pieces as lists of sticker indices sharing one cubie
export const PIECES = [...STICKERS.reduce((m, s, i) => m.set(s.pos.join(), [...(m.get(s.pos.join()) ?? []), i]), new Map<string, number[]>()).values()].filter(p => p.length > 1)

export function scramble(n = 22) {
  const out: string[] = []
  while (out.length < n) {
    const m = 'URFDLB'[(Math.random() * 6) | 0] + ['', "'", '2'][(Math.random() * 3) | 0]
    if (m[0] !== out.at(-1)?.[0]) out.push(m)
  }
  return out.join(' ')
}

// Merge neighbouring turns of the same face (U U2 -> U') and drop turns that cancel
export function simplify(alg: string) {
  const out: [string, number][] = []
  for (const m of toMoves(alg)) {
    const n = m.endsWith('2') ? 2 : m.endsWith("'") ? 3 : 1
    const last = out.at(-1)
    if (last?.[0] !== m[0]) out.push([m[0], n])
    else if (!(last[1] = (last[1] + n) % 4)) out.pop()
  }
  return out.map(([f, n]) => f + ['', '', '2', "'"][n]).join(' ')
}

// The same algorithm done after k whole-cube y turns, written for the original grip
const AFTER_Y: Record<string, string> = { F: 'R', R: 'B', B: 'L', L: 'F' }
export const relabel = (alg: string, k: number) =>
  toMoves(alg).map(m => { let f = m[0]; for (let i = 0; i < k; i++) f = AFTER_Y[f] ?? f; return f + m.slice(1) }).join(' ')
