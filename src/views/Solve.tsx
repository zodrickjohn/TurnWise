import { useEffect, useMemo, useRef, useState } from 'react'
import type { Cube3D } from '../cube/Cube3D.ts'
import { invertMove, move, toMoves, type State } from '../cube/model.ts'
import { timeline } from '../cube/solver.ts'
import { Confetti, CubeView, Icon, KIT, Mini, Tiles, describe, faceColor, load, phaseOf, save, toTop } from '../ui.tsx'
import type { Puzzle } from '../App.tsx'
import { Coach } from '../Coach.tsx'
import { stickerBurst } from '../cubie.ts'

const SPEEDS: [string, number][] = [['Slow', 950], ['Normal', 600], ['Fast', 320]]
export type Fix = { at: number; wrong: string }
type Props = { puzzle: Puzzle; again: () => void; practice: () => void; onMismatch: (expected: State, pos: number) => void; fix?: Fix; notice?: string }

export default function Solve({ puzzle: { start, plan, size }, again, practice, onMismatch, fix, notice }: Props) {
  const { stages: STAGES, phases: PHASES, art: STEP_ART } = KIT[size]
  const last = STAGES.length - 1
  const cube = useRef<Cube3D>(null)
  const busy = useRef(false)
  const key = start.join('')
  const resumed = useMemo(() => { const s = load<{ key?: string; pos?: number }>('pos', {}); return fix ? fix.at : s.key === key && Number.isInteger(s.pos) ? s.pos! : 0 }, [])
  const posRef = useRef(resumed)
  const playingRef = useRef(false)
  const [pos, setPos] = useState(resumed)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(600)
  const [pending, setPending] = useState(fix ? invertMove(fix.wrong) : '') // a stray turn to undo before carrying on
  const [cleared, setCleared] = useState(-1) // a step just finished: Cubie celebrates it for a moment

  // Every move with its place in the plan, the cube state before it, and its tile color
  const { moves, states, colors, lineStart } = useMemo(() => {
    const { moves, states } = timeline(start, plan)
    const lineStart = new Map<string, number>()
    moves.forEach((t, i) => { const k = `${t.stage}.${t.chunk}.${t.line}`; if (!lineStart.has(k)) lineStart.set(k, i) })
    return { moves, states, lineStart, colors: moves.map((t, k) => faceColor(states[k], t.m)) }
  }, [plan, start])
  const at = Math.min(resumed, moves.length)
  useEffect(() => { save('pos', { key, pos }) }, [pos])
  const span = (k: number) => [moves.findIndex(t => t.stage === k), moves.findLastIndex(t => t.stage === k) + 1]

  const done = pos >= moves.length
  const cur = moves[pos]
  const stage = done ? last : cur.stage

  const step = async (dir: 1 | -1) => {
    const p = posRef.current
    if (busy.current || pending || (dir === 1 ? p >= moves.length : p <= 0)) return false
    busy.current = true
    await cube.current?.play(dir === 1 ? moves[p].m : invertMove(moves[p - 1].m), speed)
    posRef.current = p + dir
    setPos(p + dir)
    busy.current = false
    if (p + dir === moves.length) cube.current?.spin()
    if (dir === 1 && moves[p + 1]?.stage !== moves[p].stage) celebrate(moves[p].stage)
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

  const playFix = async () => {
    if (busy.current) return
    busy.current = true
    await cube.current?.play(pending, 800)
    busy.current = false
    setPending('')
  }

  // A finished step: shards burst from its progress segment and Cubie cheers
  const cheerTimer = useRef(0)
  const celebrate = (k: number) => {
    const seg = document.querySelectorAll('.seg')[k]
    if (seg) {
      const r = seg.getBoundingClientRect()
      stickerBurst(r.left + r.width / 2, r.top + r.height / 2, 16)
      seg.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12, 1.3)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
    }
    setCleared(k)
    clearTimeout(cheerTimer.current)
    cheerTimer.current = window.setTimeout(() => setCleared(-1), 2600)
  }

  const jump = (p: number) => {
    if (busy.current || pending) return
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
  useEffect(() => { done ? toTop() : document.querySelector('.line.current')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [pos])

  const info = STAGES[stage]
  const phase = PHASES[phaseOf(stage, PHASES)]
  return (
    <div className={'solve-wrap tone-' + phase.tone}>
      <nav className="rail" aria-label="Solve progress">
        {STAGES.map((s, k) => {
          const [a, b] = span(k)
          const fill = a < 0 ? 1 : Math.min(1, Math.max(0, (pos - a) / (b - a)))
          return (
            <button key={k} className={`seg tone-${PHASES[phaseOf(k, PHASES)].tone}${k === stage && !done ? ' on' : ''}`} style={{ flexGrow: Math.max(b - a, 6) }}
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
            <Coach className="now-coach" size={84}
              mood={done || cleared >= 0 ? 'cheer' : pending ? 'wow' : playing ? 'happy' : 'idle'}
              sayKey={done ? 'done' : cleared >= 0 ? `clear-${cleared}` : pending ? 'fix' : pos}
              say={done ? 'Solved! Every one of those turns was yours.'
                : cleared >= 0 ? <><b>Step {cleared + 1} done!</b> {STAGES[cleared].title} is complete.{cleared < last && <> Up next: {STAGES[cleared + 1].title}.</>}</>
                : pending ? <span className="say-move"><Tiles alg={pending} colors={[faceColor(move(states[at], fix!.wrong), pending)]} at={0} size="xl" /><span><b>Fix first.</b> {describe(pending)}</span></span>
                : <span className="say-move"><Tiles alg={cur.m} colors={[colors[pos]]} at={0} size="xl" /><span>{describe(cur.m)}</span></span>} />
            <CubeView cubeRef={cube} initial={fix ? move(states[at], fix.wrong) : states[at]} size={size} />
            <div className="transport">
              <button className="btn white icon" onClick={() => step(-1)} disabled={pos === 0 || !!pending} aria-label="Previous move (left arrow)"><Icon name="prev" /></button>
              {pending
                ? <button className="btn yellow play" onClick={playFix}><Icon name="undo" /> Play the fix</button>
                : <button className="btn yellow play" onClick={playLine} disabled={done}><Icon name={playing ? 'pause' : 'play'} /> {playing ? 'Pause' : 'Play this line'}</button>}
              <button className="btn white icon" onClick={() => step(1)} disabled={done || !!pending} aria-label="Next move (right arrow)"><Icon name="next" /></button>
            </div>
            <div className="speed" role="radiogroup" aria-label="Animation speed">
              {SPEEDS.map(([label, ms]) => <button key={label} role="radio" aria-checked={speed === ms} onClick={() => setSpeed(ms)}>{label}</button>)}
              <span className="keys"><kbd className="key">←</kbd> <kbd className="key">→</kbd> step, <kbd className="key">space</kbd> plays</span>
            </div>
            {!done && (
              <button className="mismatch" onClick={() => onMismatch(states[pos], pos)}>
                <Icon name="search" size={18} /> My cube doesn't match the screen
              </button>
            )}
          </div>
        </aside>

        <article className="lesson">
          {done ? (
            <section className="finish">
              <Confetti />
              <span className="stamp">Solved</span>
              <h1>{moves.length} moves. Every one of them yours.</h1>
              <p className="lede">That's the whole beginner's method{size === 2 ? ' for the 2×2' : ''}. Scramble your cube and go again: this time read "What to look for" before you press play, and try to predict each move.</p>
              <div className="actions">
                <button className="btn yellow" onClick={again}>Solve another cube <Icon name="arrow" size={18} /></button>
                <button className="btn white" onClick={practice}>Practice a step on your own</button>
                <button className="btn ghost" onClick={() => jump(0)}><Icon name="reset" size={18} /> Replay from the start</button>
              </div>
            </section>
          ) : (
            <>
              <header className="step-head" key={stage}>
                <span className="step-badge">{stage + 1}</span>
                <div>
                  <p className="step-of">Step {stage + 1} of {STAGES.length}, {phase.name.toLowerCase()}</p>
                  <h1>{info.title}</h1>
                </div>
                <Mini pattern={STEP_ART[stage].pattern} label={`${STEP_ART[stage].view} face when this step is done`} />
              </header>
              <p className="lede goal">{info.goal}</p>
              {notice && pos === resumed ? <p className="hold" role="status">{notice}</p>
                : pos === 0 ? <p className="hold">{size === 3 ? <>Hold your cube with <b>yellow on top</b> and <b>green facing you</b>, then follow along.</> : <>Hold your cube <b>the way you painted it</b>, then follow along.</>}</p>
                : pos === resumed && <p className="hold">Welcome back. Your cube is where you left it at step {stage + 1}. Make sure your real cube matches the one on screen.</p>}
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
