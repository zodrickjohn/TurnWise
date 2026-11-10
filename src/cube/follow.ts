// "Follow the pieces": which stickers a stretch of a solve brings home, so the 3D cube can light them and draw their paths
import { PIECES, invertMove, type Size, type State } from './model.ts'

type Turn = (s: State, alg: string) => State
const rotations = (ms: string[]) => ms.filter(m => /^[xyz]/.test(m)).reverse().map(invertMove).join(' ')

// Moves a..b-1 of a timeline (states[k] is the cube before move k). Returns the stickers that end the stretch home but
// didn't start it home, as positions at move a. Home is the solved cube held the way it is held at that moment.
// On a 2×2 / 3×3 whole pieces count first, so a stray matching sticker doesn't light up; nothing clear (or too much) returns []
// daisy: the beginner's first step parks white edges around the yellow center, so "home" there is a white petal on top
export function arrivals(turn: Turn, states: State[], ms: string[], a: number, b: number, size: Size, daisy = false): number[] {
  const solvedAt = (k: number) => turn(states.at(-1)!, rotations(ms.slice(k)))
  const from = states[a], end = states[b], ta = solvedAt(a), tb = solvedAt(b)
  const src = ms.slice(a, b).reduce(turn, from.map((_, i) => String(i))).map(Number) // src[i]: where the sticker now at i started
  const real = (i: number) => end[i] !== '_'
  const home = (i: number) => real(i) && end[i] === tb[i]
  const was = (i: number) => from[src[i]] === ta[src[i]]
  if (daisy) {
    const petal = (s: State, i: number) => [1, 3, 5, 7].includes(i) && s[i] === 'w'
    return PIECES.filter(p => p.some(i => petal(end, i) && !petal(from, src[i]))).flat().map(i => src[i])
  }
  let got = size <= 3 ? PIECES.filter(p => p.every(i => !real(i) || home(i)) && p.some(i => real(i) && !was(i))).flat().filter(real) : []
  if (!got.length) got = end.map((_, i) => i).filter(i => home(i) && !was(i))
  return got.length > 16 ? [] : got.map(i => src[i])
}

// Carry a set of positions forward through some moves
export const carry = (turn: Turn, at: number[], n: number, alg: string) =>
  turn(Array.from({ length: n }, (_, i) => (at.includes(i) ? '1' : '0')), alg).flatMap((c, i) => (c === '1' ? [i] : []))
