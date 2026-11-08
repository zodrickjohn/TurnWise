import { useEffect, useRef, useState } from 'react'
import type { Cube3D } from '../cube/Cube3D.ts'
import { SOLVED, move, scramble, toMoves } from '../cube/model.ts'
import { STAGES, solve } from '../cube/solver.ts'
import { CubeView, Icon, Mini, PHASES, STEP_ART, Tiles, faceColor, reduceMotion } from '../ui.tsx'
import type { View } from '../App.tsx'

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const STILL = move(SOLVED, "R U R' U' F2 L D'")
const MARQUEE = "R U R' U' F R U R' U' F' y U R U' L' U R' U' L R' D' R D U2 F2"
const MARQUEE_COLORS = toMoves(MARQUEE).map(m => faceColor(SOLVED, m))

export default function Home({ go }: { go: (v: View) => void }) {
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

  const status = demo.stage === -2 ? 'Drag the cube to look around' : demo.stage === -1 ? 'Scrambling' : demo.stage === 8 ? 'Solved in 8 steps' : STAGES[demo.stage].title
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1>Solve your cube. Understand every turn.</h1>
          <p className="lede">
            Paint in your scrambled cube's colors. Turnwise walks you through the beginner's method one move at a time,
            and tells you what to look for and why each move works.
          </p>
          <div className="actions">
            <button className="btn yellow" onClick={() => go('learn')}>Start learning <Icon name="arrow" size={18} /></button>
            <button className="btn white" onClick={() => go('input')}>I have a scrambled cube</button>
          </div>
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

      <section className="journey-intro" aria-labelledby="how-h">
        <h2 id="how-h">Three stops from scrambled to solved</h2>
        <ol className="stops">
          <li className="stop s1">
            <span className="stop-n">1</span>
            <h3>Learn the moves</h3>
            <p>Letters like R and U' are the language of the cube. Five minutes and you can read any algorithm.</p>
            <button className="btn white" onClick={() => go('learn')}>Learn the moves</button>
          </li>
          <li className="stop s2">
            <span className="stop-n">2</span>
            <h3>Paint your cube</h3>
            <p>Copy your cube into the app, one face at a time. The 3D cube turns to show you exactly how to hold it.</p>
            <button className="btn white" onClick={() => go('input')}>Paint your cube</button>
          </li>
          <li className="stop s3">
            <span className="stop-n">3</span>
            <h3>Follow along</h3>
            <p>Watch each move, copy it on your real cube, and read why it works. Step by step until it's solved.</p>
          </li>
        </ol>
      </section>

      <section className="method" aria-labelledby="method-h">
        <h2 id="method-h">The method: eight steps, bottom to top</h2>
        <p className="sub">You build the cube in three layers. Each step only needs moves you already know.</p>
        <div className="phases">
          {PHASES.map(ph => (
            <section key={ph.name} className={'phase tone-' + ph.tone} style={{ flexGrow: ph.steps.length }}>
              <h3 className="phase-name">{ph.name}</h3>
              <ol>
                {ph.steps.map(i => (
                  <li key={i} className="step">
                    <Mini pattern={STEP_ART[i].pattern} label={`${STEP_ART[i].view} face when step ${i + 1} is done`} />
                    <div>
                      <h4><span className="step-n">{i + 1}</span>{STAGES[i].title}</h4>
                      <p>{STAGES[i].goal}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <h2>Grab your cube.</h2>
        <p>Keep it next to you. Every move shows up on screen first, then you copy it.</p>
        <button className="btn ink" onClick={() => go('learn')}>Start learning <Icon name="arrow" size={18} /></button>
      </section>
      <footer className="foot">Turnwise. Made for anyone holding a scrambled cube right now.</footer>
    </>
  )
}
