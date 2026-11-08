// Self-check: solve random scrambles, confirm solved; confirm impossible cubes are rejected
import assert from 'node:assert'
import { SOLVED, isSolved, move, scramble } from '../src/cube/model.ts'
import { IMPOSSIBLE, solve, validate } from '../src/cube/solver.ts'

assert(isSolved(move(SOLVED, "R U R' U' ".repeat(6))), 'trigger x6 returns to solved')

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
