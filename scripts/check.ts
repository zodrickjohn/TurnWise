// Self-check: solve random scrambles, confirm solved; confirm impossible cubes are rejected
import assert from 'node:assert'
import { SOLVED, isSolved, move, scramble, toMoves } from '../src/cube/model.ts'
import { IMPOSSIBLE, solve, validate } from '../src/cube/solver.ts'

assert(isSolved(move(SOLVED, "R U R' U' ".repeat(6))), 'trigger x6 returns to solved')
import { invertMove } from '../src/cube/model.ts'
assert.deepEqual(["R'", "Rw'", 'r', 'U2', "3Rw'"].map(invertMove), ['R', 'Rw', "r'", 'U2', '3Rw'], 'inverse keeps big-cube notation')

const N = Number(process.argv[2] ?? 200)
let total = 0, worst = 0
const t0 = performance.now()
for (let i = 0; i < N; i++) {
  const start = move(SOLVED, scramble())
  assert.equal(validate(start), null)
  const t = performance.now()
  const algs = solve(start).flat().flatMap(c => c.lines.map(l => l.alg))
  worst = Math.max(worst, performance.now() - t)
  const end = algs.reduce(move, start)
  assert(isSolved(end), 'not solved: ' + algs.join(' | '))
  total += algs.join(' ').split(' ').filter(Boolean).length
}
console.log(`${N} solves ok, avg ${(total / N).toFixed(0)} moves, avg ${((performance.now() - t0) / N).toFixed(0)}ms, worst ${worst.toFixed(0)}ms`)

// Flipped edge (swap the two stickers of UF) must be rejected
const flipped = [...SOLVED]; [flipped[7], flipped[19]] = [flipped[19], flipped[7]]
assert.equal(validate(flipped), null)
assert.throws(() => solve(move(flipped, scramble())), { message: IMPOSSIBLE })
// Twisted corner
const twisted = [...SOLVED]; [twisted[8], twisted[9], twisted[20]] = [twisted[9], twisted[20], twisted[8]]
assert.throws(() => solve(move(twisted, scramble())), { message: IMPOSSIBLE })
assert.match(validate(['_', ...SOLVED.slice(1)])!, /blank/)
console.log('impossible cubes rejected ok')

// Which top edges does the yellow-edge algorithm swap?
const after = move(SOLVED, "R U R' U R U2 R' U")
console.log('UB,UL,UR,UF side stickers after alg:', [46, 37, 10, 19].map(i => after[i]).join(' '), '(solved: b r o g)')

// Camera color recognition: references, plus dim and washed-out readings of the tricky pairs
import { DEFAULT_REF, classify, type RGB } from '../src/cube/colors.ts'
for (const [c, rgb] of Object.entries(DEFAULT_REF)) assert.equal(classify(rgb), c)
const samples: [RGB, string][] = [[[150, 140, 30], 'y'], [[240, 225, 120], 'y'], [[160, 165, 170], 'w'], [[245, 245, 240], 'w'],
  [[140, 25, 35], 'r'], [[210, 60, 50], 'r'], [[250, 140, 60], 'o'], [[190, 90, 25], 'o'], [[20, 110, 60], 'g'], [[25, 55, 140], 'b']]
for (const [rgb, c] of samples) assert.equal(classify(rgb), c, `classify(${rgb}) should be ${c}`)
console.log('color recognition ok')

// Step-done checks and the mistake detective
import { diagnose, normalize, stageDone, timeline } from '../src/cube/solver.ts'
{
  const start = move(SOLVED, scramble())
  const { moves, states } = timeline(start, solve(start))
  const ends = [0, 1, 2, 3, 4, 5, 6, 7].map(k => moves.findLastIndex(t => t.stage <= k) + 1)
  ends.forEach((e, k) => assert(stageDone(k, states[e]), `step ${k + 1} done at its end`))
  assert(!stageDone(7, start) && stageDone(7, states.at(-1)!))
  const pos = 60
  assert.deepEqual(diagnose(states, pos, normalize(states[pos])), { kind: 'same', at: pos })
  // Identical cubes can recur along a solve; any position holding the same cube is a correct answer
  const back = diagnose(states, pos, normalize(states[pos - 7]))
  assert(back.kind === 'jump' && normalize(states[back.at]).join('') === normalize(states[pos - 7]).join(''))
  // A stray turn can land on another point of the plan; either answer must rebuild the same cube
  const target = normalize(move(states[pos + 3], "R'")).join('')
  const slip = diagnose(states, pos, normalize(move(states[pos + 3], "R'")))
  assert(slip.kind !== 'new' && normalize(slip.kind === 'slip' ? move(states[slip.at], slip.wrong!) : states[slip.at]).join('') === target)
  assert.equal(diagnose(states, pos, normalize(move(SOLVED, scramble()))).kind, 'new')
  console.log('step checks and mistake detective ok')
}

// Real-cube practice setups: short, start each step with earlier steps intact
import { relabel, simplify } from '../src/cube/model.ts'
import { practiceSetup } from '../src/cube/solver.ts'
assert.equal(simplify("U U2 R R' F2 F2 D"), "U' D")
assert.equal(move(SOLVED, "y R U R' U' y'").join(''), move(SOLVED, relabel("R U R' U'", 1)).join(''))
for (let k = 0; k < 8; k++) for (let i = 0; i < 20; i++) {
  const { setup, start, par } = practiceSetup(k)
  assert(!stageDone(k, start) && (k === 0 || stageDone(k - 1, start)) && par > 0, `setup for step ${k + 1}`)
  assert(toMoves(setup).length <= 40, `setup for step ${k + 1} is short: ${setup}`)
}
console.log('practice setups ok:', [0, 1, 2, 3, 4, 5, 6, 7].map(k => toMoves(practiceSetup(k).setup).length).join(' / '), 'moves')
import { practiceFrom } from '../src/cube/solver.ts'
for (let k = 0; k < 8; k++) {
  const cubeNow = move(SOLVED, scramble())
  const { start, par } = practiceFrom(cubeNow, k)
  assert(k === 0 || stageDone(k - 1, start), `from a scramble, steps before ${k + 1} are done`)
  assert(par === 0 ? stageDone(k, start) : !stageDone(k, start))
}
console.log('practice from a scrambled cube ok')

// 2x2: random corner states solve from the best frame, steps complete in order, bad cubes rejected
import { cornersOnly } from '../src/cube/model.ts'
import { SOLVED2, prepare } from '../src/cube/solver.ts'
{
  let moves2 = 0, worst2 = 0
  for (let i = 0; i < 100; i++) {
    const cube = cornersOnly(move(SOLVED, scramble()))
    assert.equal(validate(cube, 2), null)
    const t = performance.now()
    const { start, plan } = prepare(cube, 2)
    worst2 = Math.max(worst2, performance.now() - t)
    assert.equal(cornersOnly(start).join(''), cube.join(''), 'the frame only adds invisible centers')
    const { moves, states } = timeline(start, plan)
    const ends = [0, 1, 2].map(k => moves.findLastIndex(t => t.stage <= k) + 1)
    ends.forEach((e, k) => assert(stageDone(k, states[e], 2), `2x2 step ${k + 1} done at its end`))
    assert(isSolved(states.at(-1)!), '2x2 not solved')
    moves2 += moves.length
  }
  const twisted2 = cornersOnly(SOLVED); [twisted2[8], twisted2[9], twisted2[20]] = [twisted2[9], twisted2[20], twisted2[8]]
  assert.throws(() => prepare(move(twisted2, scramble()), 2), { message: IMPOSSIBLE })
  assert.match(validate(cornersOnly(['_', ...SOLVED.slice(1)]), 2)!, /blank/)
  const pos = 12, { states } = timeline(...(({ start, plan }) => [start, plan] as const)(prepare(cornersOnly(move(SOLVED, scramble())), 2)))
  assert.equal(diagnose(states, pos, cornersOnly(move(states[pos], 'y')), 2).kind, 'same', 'a turned 2x2 still matches')
  for (let k = 0; k < 3; k++) for (let i = 0; i < 20; i++) {
    const { start, par } = practiceSetup(k, 2)
    assert(!stageDone(k, start, 2) && (k === 0 || stageDone(k - 1, start, 2)) && par > 0, `2x2 setup for step ${k + 1}`)
  }
  assert(isSolved(SOLVED2))
  console.log(`2x2 ok: 100 solves, avg ${(moves2 / 100).toFixed(0)} moves, worst ${worst2.toFixed(0)}ms to plan; setups and detective ok`)
}

// 4×4 and 5×5: the parity algorithms do exactly what they claim, and random cubes solve by reduction
import { bigCube, bigScramble } from '../src/cube/big.ts'
import { solveBig, validateBig } from '../src/cube/bigsolve.ts'
{
  const changed = (N: number, alg: string) => { const b = bigCube(N); return b.move(b.SOLVED, alg).filter((c, i) => c !== b.SOLVED[i]).length }
  assert.equal(changed(5, "r2 B2 U2 l U2 r' U2 r U2 F2 r F2 l' B2 r2"), 4, '5×5 edge parity swaps just two wings')
  assert.equal(changed(4, "r2 U2 r2 Uw2 r2 Uw2"), 12, '4×4 PLL parity touches only the top layer')
  for (let i = 0; i < 50; i++) { const alg = scramble() + " y2 U y'"; assert.equal(bigCube(3).move(SOLVED, alg).join(''), move(SOLVED, alg).join(''), 'N×N model agrees with the 3×3 model') }
  for (const [N, runs] of [[4, 6], [5, 3]] as const) {
    const b = bigCube(N), A = N * N, mid = (N - 1) >> 1
    let total = 0, t = performance.now()
    for (let i = 0; i < runs; i++) {
      const start = b.move(b.SOLVED, bigScramble())
      assert.equal(validateBig(start, N), null)
      const end = b.move(start, solveBig(start, N).flat().flatMap(c => c.lines.map(l => l.alg)).join(' '))
      assert(end.every((c, j) => c === end[Math.floor(j / A) * A + mid * N + mid]), `${N}×${N} not solved`)
      total += 1
    }
    console.log(`${N}×${N} ok: ${total} solves by reduction, avg ${((performance.now() - t) / runs).toFixed(0)}ms`)
  }
  assert.match(validateBig(bigCube(4).SOLVED.map((c, i) => (i ? c : '_')), 4)!, /blank/)
}

// Scanning any size: perfect in even light, and still near perfect under a warm, dim bulb (plain nearest-color misses 2-14 stickers there)
import { classifyAll } from '../src/cube/colors.ts'
{
  const warm = ([r, g, b]: RGB): RGB => [Math.min(255, r * 0.8 + 25), g * 0.72, b * 0.55]
  for (const [light, tint, noise, limit] of [['even', (c: RGB) => c, 40, 0], ['warm', warm, 24, 0.01]] as const) for (const N of [2, 3, 4, 5]) {
    const truth = Array.from({ length: 6 * N * N }, (_, i) => 'wyrogb'[i % 6])
    let wrong = 0
    for (let trial = 0; trial < 20; trial++) {
      const px = truth.map(c => (tint as (c: RGB) => RGB)(DEFAULT_REF[c]).map(v => Math.max(0, Math.min(255, v + (Math.random() - 0.5) * noise))) as RGB)
      const mid = (N - 1) >> 1, fixed = truth.map((c, i) => (N % 2 && i % (N * N) === mid * N + mid ? c : null))
      wrong += classifyAll(px, fixed, N * N).labels.filter((c, i) => c !== truth[i]).length
    }
    assert(wrong / 20 <= limit * truth.length, `${N}×${N} scan in ${light} light: ${wrong / 20} wrong per cube`)
  }
  console.log('scan classification ok for 2×2 to 5×5')
}

// Practice and the detective for big cubes: setups start each step with earlier steps intact; the detective sees through grips
import { runTask, stageDoneAny } from '../src/cube/bigsolve.ts'
import type { Chunk } from '../src/cube/solver.ts'
{
  const t0 = performance.now()
  for (const [N, steps] of [[4, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]], [5, [1, 2, 3, 8]]] as const) for (const k of steps) {
    const { start, par } = runTask({ kind: 'setup', step: k, size: N }) as { start: string[]; par: number }
    assert(!stageDoneAny(k, start, N) && (k === 0 || stageDoneAny(k - 1, start, N)) && par > 0, `${N}×${N} setup for step ${k + 1}`)
  }
  const b = bigCube(4), cube = b.move(b.SOLVED, bigScramble()), { start, plan } = runTask({ kind: 'plan', cube, size: 4 }) as { start: string[]; plan: Chunk[][] }
  const { states } = timeline(start, plan, 4)
  const ask = (actual: string[], pos: number) => runTask({ kind: 'diagnose', start, plan, pos, actual, size: 4 }) as { kind: string; at: number; wrong?: string }
  assert.equal(ask(b.move(states[90], 'z y'), 90).kind, 'same', 'a 4×4 held another way still matches')
  const slip = ask(b.move(states[95], "u'"), 90)
  assert(slip.kind === 'slip' || slip.kind === 'jump', 'a stray slice turn is found')
  console.log(`big-cube practice setups and detective ok (${((performance.now() - t0) / 1000).toFixed(1)}s)`)
}

// Levels: intermediate and expert solve every cube; expert stays within its known bounds
import { planSmall } from '../src/cube/methods.ts'
{
  const t0 = performance.now(), avg: string[] = []
  for (const [size, level, bound] of [[2, 'intermediate', 60], [2, 'expert', 11], [3, 'intermediate', 140], [3, 'expert', 24]] as const) {
    let total = 0
    for (let i = 0; i < 40; i++) {
      const raw = move(SOLVED, scramble()), cube = size === 2 ? cornersOnly(raw) : raw
      const { start, plan } = planSmall(cube, size, level)
      const alg = plan.flat().flatMap(c => c.lines.map(l => l.alg)).join(' '), n = toMoves(alg).length
      assert(isSolved(move(start, alg)), `${size}×${size} ${level} solves`)
      assert(n <= bound, `${size}×${size} ${level}: ${n} moves is over ${bound}`)
      total += n
    }
    avg.push(`${size}×${size} ${level} ${(total / 40).toFixed(0)}`)
  }
  for (const [N, level] of [[4, 'intermediate'], [4, 'expert'], [5, 'expert']] as const) {
    const b = bigCube(N), A = N * N, mid = (N - 1) >> 1, start = b.move(b.SOLVED, bigScramble())
    const end = b.move(start, solveBig(start, N, level).flat().flatMap(c => c.lines.map(l => l.alg)).join(' '))
    assert(end.every((c, j) => c === end[Math.floor(j / A) * A + mid * N + mid]), `${N}×${N} ${level} solves`)
  }
  console.log(`levels ok (avg moves: ${avg.join(', ')}) in ${((performance.now() - t0) / 1000).toFixed(1)}s`)
}
