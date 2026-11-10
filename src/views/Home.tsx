import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Cube3D } from '../cube/Cube3D.ts'
import { SOLVED, move, scramble, toMoves } from '../cube/model.ts'
import { STAGES, solve } from '../cube/solver.ts'
import { CubeView, Icon, Install, Tiles, faceColor, reduceMotion, revealOnScroll } from '../ui.tsx'
import { ScrollSolve, Showcase } from './HomeSections.tsx'
import type { View } from '../App.tsx'
import { Coach } from '../Coach.tsx'

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const STILL = move(SOLVED, "R U R' U' F2 L D'")
const MARQUEE = "R U R' U' F R U R' U' F' y U R U' L' U R' U' L R' D' R D U2 F2"
const MARQUEE_COLORS = toMoves(MARQUEE).map(m => faceColor(SOLVED, m))

export default function Home({ go, resume }: { go: (v: View) => void; resume: boolean }) {
  const cube = useRef<Cube3D>(null)
  const [demo, setDemo] = useState<{ stage: number; m: string; c: string }>({ stage: -2, m: '', c: '' })

  // Hero demo: scramble, then solve at a readable pace with the same 8-step method the app teaches
  useEffect(() => {
    if (reduceMotion) return
    let alive = true
    ;(async () => {
      await wait(1600)
      while (alive && cube.current) {
        const c = cube.current
        setDemo({ stage: -1, m: '', c: '' })
        for (const m of toMoves(scramble(18))) if (alive) await c.play(m, 230)
        await wait(900)
        for (const [stage, chunks] of solve(c.state).entries()) {
          const ms = chunks.flatMap(ch => ch.lines.flatMap(l => toMoves(l.alg)))
          if (!ms.length || !alive) continue
          setDemo({ stage, m: '', c: '' })
          await wait(1100)
          for (const m of ms) {
            if (!alive) return
            setDemo({ stage, m, c: faceColor(c.state, m) })
            await c.play(m, 400)
          }
        }
        if (!alive) return
        setDemo({ stage: 8, m: '', c: '' })
        c.spin()
        await wait(3800)
      }
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => revealOnScroll(), [])
  const status = demo.stage === -2 ? 'Drag the cube to look around' : demo.stage === -1 ? 'Scrambling' : demo.stage === 8 ? 'Solved in 8 steps' : STAGES[demo.stage].title
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1 aria-label="Solve your cube. Understand every turn.">
            {'Solve your cube. Understand every turn.'.split(' ').map((w, i) => <span key={i} className="w" aria-hidden="true" style={{ '--i': i } as CSSProperties}>{w} </span>)}
          </h1>
          <p className="lede">
            Paint or scan any cube from 2×2 to 5×5. Turnwise walks you through it one move at a time: learn the beginner's
            method with why every move works, step up to intermediate, or follow the shortest expert solve.
          </p>
          <div className="actions">
            {resume ? <>
              <button className="btn yellow" onClick={() => go('solve')}><Icon name="play" size={18} /> Continue your solve</button>
              <button className="btn white" onClick={() => go('input')}>Paint a new cube</button>
            </> : <>
              <button className="btn yellow" onClick={() => go('learn')}>Start learning <Icon name="arrow" size={18} /></button>
              <button className="btn white" onClick={() => go('input')}>I have a scrambled cube</button>
            </>}
          </div>
          <Coach className="hero-coach" size={96} mood="wave" sayKey="hi"
            say={<>Hi, I'm <b>Cubie</b>, your coach! Psst: try clicking the sun up there.</>} />
        </div>
        <figure className="hero-cube">
          <CubeView cubeRef={cube} initial={reduceMotion ? STILL : SOLVED} follow />
          <figcaption className="demo-chip" aria-live="off">
            {demo.stage >= 0 && demo.stage < 8 && <span key={demo.stage} className="demo-step">Step {demo.stage + 1}</span>}
            <span className="demo-title">{status}</span>
            {demo.m && <Tiles alg={demo.m} colors={[demo.c]} at={0} />}
          </figcaption>
        </figure>
      </section>

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map(k => <Tiles key={k} alg={MARQUEE} colors={MARQUEE_COLORS} />)}
        </div>
      </div>

      <ScrollSolve />
      <Showcase go={go} />

      <section className="cta-band">
        <h2>Grab your cube.</h2>
        <p>Keep it next to you. Every move shows up on screen first, then you copy it.</p>
        <div className="actions">
          <button className="btn ink" onClick={() => go('learn')}>Start learning <Icon name="arrow" size={18} /></button>
          <Install />
        </div>
      </section>
      <footer className="foot">Turnwise. Made for anyone holding a scrambled cube right now.</footer>
    </>
  )
}
