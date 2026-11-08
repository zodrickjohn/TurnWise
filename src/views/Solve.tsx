import { useEffect, useMemo, useRef, useState } from 'react'
import type { Cube3D } from '../cube/Cube3D.ts'
import { invertMove, move, toMoves } from '../cube/model.ts'
import { STAGES } from '../cube/solver.ts'
import { CubeView, Icon, Mini, PHASES, STEP_ART, Tiles, describe, faceColor, phaseOf } from '../ui.tsx'
import type { Puzzle } from '../App.tsx'

const SPEEDS: [string, number][] = [['Slow', 950], ['Normal', 600], ['Fast', 320]]
const CONFETTI = Array.from({ length: 36 }, (_, i) => ({ c: 'wyrogb'[i % 6], x: (i * 37) % 100, d: (i % 9) * 0.08, r: (i * 53) % 360 }))

export default function Solve({ puzzle: { start, plan }, again }: { puzzle: Puzzle; again: () => void }) {
  const cube = useRef<Cube3D>(null)
  const busy = useRef(false)
  const posRef = useRef(0)
  const playingRef = useRef(false)
  const [pos, setPos] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(600)

  // Flat list of every move with its stage/chunk/line, the cube state before it, and its tile color
  const { moves, states, colors, lineStart } = useMemo(() => {
    const moves: { stage: number; chunk: number; line: number; m: string }[] = []
    const lineStart = new Map<string, number>()
    plan.forEach((chunks, stage) => chunks.forEach((ch, chunk) => ch.lines.forEach((l, line) => {
      lineStart.set(`${stage}.${chunk}.${line}`, moves.length)
      toMoves(l.alg).forEach(m => moves.push({ stage, chunk, line, m }))
    })))
    const states = [start]
    moves.forEach(t => states.push(move(states.at(-1)!, t.m)))
    return { moves, states, lineStart, colors: moves.map((t, k) => faceColor(states[k], t.m)) }
  }, [plan, start])
  const span = (k: number) => [moves.findIndex(t => t.stage === k), moves.findLastIndex(t => t.stage === k) + 1]

  const done = pos >= moves.length
  const cur = moves[pos]
  const stage = done ? 7 : cur.stage

  const step = async (dir: 1 | -1) => {
    const p = posRef.current
    if (busy.current || (dir === 1 ? p >= moves.length : p <= 0)) return false
    busy.current = true
    await cube.current?.play(dir === 1 ? moves[p].m : invertMove(moves[p - 1].m), speed)
    posRef.current = p + dir
    setPos(p + dir)
    busy.current = false
    if (p + dir === moves.length) cube.current?.spin()
    return true
  }

  // Play the rest of the current line, then pause so the next note can be read
  const playLine = async () => {
    if (playingRef.current) return void (playingRef.current = false)
    const t = moves[posRef.current]
    if (!t) return
    playingRef.current = true
    setPlaying(true)
    while (playingRef.current) {
      const n = moves[posRef.current]
      if (!n || n.stage !== t.stage || n.chunk !== t.chunk || n.line !== t.line || !(await step(1))) break
    }
    playingRef.current = false
    setPlaying(false)
  }

  const jump = (p: number) => {
    if (busy.current) return
    playingRef.current = false
    posRef.current = p
    setPos(p)
    cube.current?.setState(states[p])
  }

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLButtonElement && e.key === ' ') return
      if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === ' ') { e.preventDefault(); playLine() }
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  })
  useEffect(() => { done ? scrollTo(0, 0) : document.querySelector('.line.current')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [pos])

  const info = STAGES[stage]
  const phase = PHASES[phaseOf(stage)]
  return (
    <div className={'solve-wrap tone-' + phase.tone}>
      <nav className="rail" aria-label="Solve progress">
        {STAGES.map((s, k) => {
          const [a, b] = span(k)
          const fill = a < 0 ? 1 : Math.min(1, Math.max(0, (pos - a) / (b - a)))
          return (
            <button key={k} className={`seg tone-${PHASES[phaseOf(k)].tone}${k === stage && !done ? ' on' : ''}`} style={{ flexGrow: Math.max(b - a, 6) }}
              onClick={() => jump(a < 0 ? Math.max(0, moves.findIndex(t => t.stage > k)) : a)} disabled={a < 0} title={`Step ${k + 1}: ${s.title}${a < 0 ? ' (already done)' : ''}`}>
              <span className="seg-fill" style={{ transform: `scaleX(${fill})` }} />
              <span className="seg-n">{fill === 1 ? <Icon name="check" size={14} /> : k + 1}</span>
            </button>
          )
        })}
      </nav>

      <div className="split solve">
        <aside className="stage">
          <div className="stage-card">
            <div className="now-move" aria-live="polite">
              {done ? <p className="big-say">Solved!</p> : (
                <>
                  <Tiles alg={cur.m} colors={[colors[pos]]} at={0} size="xl" key={pos} />
                  <p className="big-say">{describe(cur.m)}</p>
                </>
              )}
            </div>
            <CubeView cubeRef={cube} initial={start} />
            <div className="transport">
              <button className="btn white icon" onClick={() => step(-1)} disabled={pos === 0} aria-label="Previous move (left arrow)"><Icon name="prev" /></button>
              <button className="btn yellow play" onClick={playLine} disabled={done}><Icon name={playing ? 'pause' : 'play'} /> {playing ? 'Pause' : 'Play this line'}</button>
              <button className="btn white icon" onClick={() => step(1)} disabled={done} aria-label="Next move (right arrow)"><Icon name="next" /></button>
            </div>
            <div className="speed" role="radiogroup" aria-label="Animation speed">
              {SPEEDS.map(([label, ms]) => <button key={label} role="radio" aria-checked={speed === ms} onClick={() => setSpeed(ms)}>{label}</button>)}
              <span className="keys"><kbd className="key">←</kbd> <kbd className="key">→</kbd> step, <kbd className="key">space</kbd> plays</span>
            </div>
          </div>
        </aside>

        <article className="lesson">
          {done ? (
            <section className="finish">
              <div className="confetti" aria-hidden="true">
                {CONFETTI.map((p, i) => <i key={i} className={'c-' + p.c} style={{ left: p.x + '%', animationDelay: p.d + 's', rotate: p.r + 'deg' }} />)}
              </div>
              <span className="stamp">Solved</span>
              <h1>{moves.length} moves. Every one of them yours.</h1>
              <p className="lede">That's the whole beginner's method. Scramble your cube and go again: this time read "What to look for" before you press play, and try to predict each move.</p>
              <div className="actions">
                <button className="btn yellow" onClick={again}>Solve another cube <Icon name="arrow" size={18} /></button>
                <button className="btn white" onClick={() => jump(0)}><Icon name="reset" size={18} /> Replay from the start</button>
              </div>
            </section>
          ) : (
            <>
              <header className="step-head" key={stage}>
                <span className="step-badge">{stage + 1}</span>
                <div>
                  <p className="step-of">Step {stage + 1} of 8, {phase.name.toLowerCase()}</p>
                  <h1>{info.title}</h1>
                </div>
                <Mini pattern={STEP_ART[stage].pattern} label={`${STEP_ART[stage].view} face when this step is done`} />
              </header>
              <p className="lede goal">{info.goal}</p>
              {pos === 0 && <p className="hold">Hold your cube with <b>yellow on top</b> and <b>green facing you</b>, then follow along.</p>}
              <div className="explain">
                <section className="panel">
                  <h2>What to look for</h2>
                  <p>{info.look}</p>
                </section>
                <section className="panel">
                  <h2>Why it works</h2>
                  <p>{info.why}</p>
                </section>
              </div>
              <h2 className="moves-h">Your moves</h2>
              {plan[stage].map((ch, ci) => (
                <section key={ci} className="chunk">
                  <h3>{ch.title}</h3>
                  {ch.lines.map((l, li) => {
                    const s0 = lineStart.get(`${stage}.${ci}.${li}`)!, len = toMoves(l.alg).length
                    const here = pos >= s0 && pos < s0 + len, past = pos >= s0 + len
                    return (
                      <button key={li} className={'line' + (here ? ' current' : past ? ' past' : '')} onClick={() => jump(s0)} aria-label={`Jump to: ${l.note}`}>
                        <span className="line-mark">{past ? <Icon name="check" size={16} /> : null}</span>
                        <Tiles alg={l.alg} colors={colors.slice(s0, s0 + len)} at={here ? pos - s0 : -1} done={pos - s0} />
                        <span className="line-note">{l.note}</span>
                      </button>
                    )
                  })}
                </section>
              ))}
            </>
          )}
        </article>
      </div>
    </div>
  )
}
