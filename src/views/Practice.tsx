import { useEffect, useMemo, useRef, useState } from 'react'
import type { Cube3D } from '../cube/Cube3D.ts'
import { SOLVED, invertMove, move, scramble, toMoves, type State } from '../cube/model.ts'
import { STAGES, solve, stageDone } from '../cube/solver.ts'
import { Confetti, CubeView, Icon, Mini, MovePad, STEP_ART, Tiles, describe, faceColor, load, save } from '../ui.tsx'

type Challenge = { step: number; start: State; par: number }

// A real cube at the start of step k: scramble, run the guide's plan up to step k, and use its move count as par
function makeChallenge(step: number): Challenge {
  for (;;) {
    const s0 = move(SOLVED, scramble())
    const plan = solve(s0)
    const algs = (k: number) => plan[k].flatMap(ch => ch.lines.map(l => l.alg)).join(' ')
    const start = plan.slice(0, step).reduce((s, _, k) => move(s, algs(k)), s0)
    const par = toMoves(algs(step)).length
    if (par) return { step, start, par }
  }
}

const starsFor = (moves: number, par: number, helped: boolean) => (helped ? 1 : moves <= par ? 3 : moves <= par * 1.6 ? 2 : 1)

function Stars({ n, label }: { n: number; label?: boolean }) {
  return (
    <span className="stars" role="img" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map(i => <i key={i} className={i < n ? 'on' : ''} />)}
      {label && <span className="sr-only">{n} of 3 stars</span>}
    </span>
  )
}

export default function Practice() {
  const cube = useRef<Cube3D>(null)
  const [ch, setCh] = useState(() => makeChallenge(Math.min(7, Math.max(0, load('practiceStep', 2)))))
  const [seq, setSeq] = useState<string[]>([])
  const [hint, setHint] = useState(0) // 0 none, 1 what to look for, 2 which piece, 3 exact moves
  const [helped, setHelped] = useState(false)
  const [best, setBest] = useState<Record<number, number>>(() => load('practiceBest', {}))
  const cur = useMemo(() => move(ch.start, seq.join(' ')), [ch, seq])
  const done = seq.length > 0 && stageDone(ch.step, cur)
  const stars = starsFor(seq.length, ch.par, helped)

  // The guide's next chunk from wherever the learner's cube is now; null if an earlier step came undone
  const next = useMemo(() => {
    if (done) return null
    const plan = solve(cur)
    return plan.some((p, k) => k < ch.step && p.length) ? null : plan[ch.step][0] ?? null
  }, [cur, done])

  useEffect(() => {
    if (!done) return
    cube.current?.spin()
    setBest(b => { const nb = { ...b, [ch.step]: Math.max(b[ch.step] ?? 0, stars) }; save('practiceBest', nb); return nb })
  }, [done])

  const turn = (m: string) => { if (done) return; setSeq(s => [...s, m]); cube.current?.play(m, 380) }
  const undo = () => { const m = seq.at(-1); if (!m || done) return; setSeq(s => s.slice(0, -1)); cube.current?.play(invertMove(m), 300) }
  const reset = () => { setSeq([]); setHint(0); setHelped(false); cube.current?.setState(ch.start) }
  const newChallenge = (step: number) => {
    const c = makeChallenge(step)
    save('practiceStep', step)
    setCh(c); setSeq([]); setHint(0); setHelped(false)
    cube.current?.setState(c.start)
  }
  const showMe = () => {
    if (!next) return
    setHelped(true)
    const ms = toMoves(next.lines[0].alg)
    setSeq(s => [...s, ...ms])
    ms.forEach(m => cube.current?.play(m, 480))
  }

  const info = STAGES[ch.step]
  const last = seq.at(-1)
  return (
    <div className="split practice">
      <article className="lesson">
        <header className="page-head">
          <h1>Practice</h1>
          <p className="lede">Pick a step. You get a real cube set up right where that step begins. Solve it with the keys or your keyboard, and only open a hint when you're stuck.</p>
        </header>

        <ol className="practice-steps" aria-label="Choose a step">
          {STAGES.map((s, k) => (
            <li key={k}>
              <button className={k === ch.step ? 'on' : ''} aria-current={k === ch.step ? 'step' : undefined} onClick={() => newChallenge(k)}>
                <Mini pattern={STEP_ART[k].pattern} label="" />
                <span className="ps-title"><b>{k + 1}</b> {s.title}</span>
                <Stars n={best[k] ?? 0} />
              </button>
            </li>
          ))}
        </ol>

        <section className={'panel challenge' + (done ? ' won' : '')} aria-live="polite">
          {done && <Confetti />}
          <div className="challenge-head">
            <span className="step-badge">{ch.step + 1}</span>
            <div>
              <h2>{info.title}</h2>
              <p>{info.goal}</p>
            </div>
          </div>
          <div className="score">
            <span className="chip">Your moves <b>{seq.length}</b></span>
            <span className="chip">Par <b>{ch.par}</b></span>
            {helped && <span className="chip muted">Used "show me"</span>}
          </div>

          {done ? (
            <div className="win">
              <span className="stamp">Step done</span>
              <Stars n={stars} label />
              <p>{seq.length <= ch.par && !helped ? `${seq.length} moves, at or under par. That's the guide's own count.` : helped ? 'Done with a little help. Try a fresh one without "show me".' : `${seq.length} moves against a par of ${ch.par}. Try another and aim lower.`}</p>
              <div className="actions">
                <button className="btn yellow" onClick={() => newChallenge(ch.step)}>Another one <Icon name="arrow" size={18} /></button>
                {ch.step < 7 && <button className="btn white" onClick={() => newChallenge(ch.step + 1)}>Next step: {STAGES[ch.step + 1].title}</button>}
              </div>
            </div>
          ) : (
            <>
              <MovePad state={cur} now={last} onMove={turn} />
              <div className="actions">
                <button className="btn white" onClick={undo} disabled={!seq.length}><Icon name="undo" size={18} /> Undo</button>
                <button className="btn ghost" onClick={reset} disabled={!seq.length}><Icon name="reset" size={18} /> Start over</button>
                <button className="btn ghost" onClick={() => newChallenge(ch.step)}>New cube</button>
              </div>
            </>
          )}
        </section>

        {!done && (
          <section className="panel hints">
            <div className="pad-head">
              <h2><Icon name="bulb" size={22} /> Hints</h2>
              {hint < 3 && <button className="btn small" onClick={() => setHint(hint + 1)}>{hint ? 'Another hint' : 'Show a hint'}</button>}
            </div>
            {!next && <p className="bad">An earlier step came undone. Undo your last few moves, or start over.</p>}
            {hint === 0 && next && <p className="note">Three hints, each one more specific. Try to get there with as few as you can.</p>}
            {hint >= 1 && <p><b>What to look for:</b> {info.look}</p>}
            {hint >= 2 && next && <p><b>Work on:</b> {next.title.replace(/^./, c => c.toLowerCase())}.</p>}
            {hint >= 3 && next && (
              <div className="hint-moves">
                <Tiles alg={next.lines[0].alg} colors={toMoves(next.lines[0].alg).reduce<[State, string[]]>(([s, cs], m) => [move(s, m), [...cs, faceColor(s, m)]], [cur, []])[1]} />
                <p>{next.lines[0].note}</p>
                <button className="btn white small" onClick={showMe}><Icon name="play" size={16} /> Show me</button>
              </div>
            )}
          </section>
        )}
      </article>

      <aside className="stage">
        <div className="stage-card">
          <CubeView cubeRef={cube} initial={ch.start} />
          <div className="say" aria-live="polite">
            {last ? <><Tiles alg={last} colors={[faceColor(move(ch.start, seq.slice(0, -1).join(' ')), last)]} at={0} size="xl" key={seq.length} /><p>{describe(last)}</p></>
              : <p>Your cube for step {ch.step + 1}. Make your first move.</p>}
          </div>
        </div>
      </aside>
    </div>
  )
}
