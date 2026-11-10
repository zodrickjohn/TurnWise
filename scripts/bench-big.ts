// Average moves per stage for 4×4/5×5 solves at a level: node scripts/bench-big.ts [level] [runs]
import { bigCube, bigScramble } from '../src/cube/big.ts'
import { solveBig } from '../src/cube/bigsolve.ts'
import { toMoves } from '../src/cube/model.ts'
const level = (process.argv[2] ?? 'expert') as 'expert', runs = Number(process.argv[3] ?? 10)
for (const N of [4, 5]) {
  const b = bigCube(N), A = N * N, mid = (N - 1) >> 1, sums: number[] = [], tot: number[] = []
  let t = 0
  for (let i = 0; i < runs; i++) {
    const start = b.move(b.SOLVED, bigScramble()), t0 = performance.now(), plan = solveBig(start, N, level)
    t += performance.now() - t0
    const end = b.move(start, plan.flat().flatMap(c => c.lines.map(l => l.alg)).join(' '))
    if (!end.every((c, j) => c === end[Math.floor(j / A) * A + mid * N + mid])) throw new Error('not solved')
    tot.push(toMoves(plan.flat().flatMap(c => c.lines.map(l => l.alg)).join(" ")).filter(m => !/^[xyz]/.test(m)).length)
    plan.forEach((p, k) => (sums[k] = (sums[k] ?? 0) + toMoves(p.flatMap(c => c.lines.map(l => l.alg)).join(' ')).filter(m => !/^[xyz]/.test(m)).length))
  }
  const avg = sums.map(x => Math.round(x / runs))
  console.log(`${N}×${N} ${level}: total ${avg.reduce((a, b) => a + b)} | per stage ${avg.join(' ')} | worst ${Math.max(...tot)} | ${Math.round(t / runs)}ms`)
}
