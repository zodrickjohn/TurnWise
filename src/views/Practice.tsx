import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Cube3D } from '../cube/Cube3D.ts'
import { FACES, SOLVED, invertMove, move, scramble, toMoves, type State } from '../cube/model.ts'
import { STAGES, practiceSetup, solve, stageDone, timeline, validate } from '../cube/solver.ts'
import { Confetti, CubeView, Icon, Mini, MovePad, STEP_ART, Tiles, describe, faceColor, load, save } from '../ui.tsx'
import Scanner from './Scanner.tsx'

type Mode = 'screen' | 'real'
const colorsAlong = (s: State, alg: string) => toMoves(alg).reduce<[State, string[]]>(([st, cs], m) => [move(st, m), [...cs, faceColor(st, m)]], [s, []])[1]
const starsFor = (moves: number, par: number, helped: boolean) => (helped ? 1 : moves <= par ? 3 : moves <= par * 1.6 ? 2 : 1)

function Stars({ n }: { n: number }) {
  return <span className="stars" role="img" aria-label={`${n} of 3 stars`}>{[0, 1, 2].map(i => <i key={i} className={i < n ? 'on' : ''} />)}</span>
}

// Shared shell: header, mode switch and step picker on the left, the mode's cube on the right
export default function Practice() {
  const [mode, setMode] = useState<Mode>(() => (load<string>('practiceMode', 'screen') === 'real' ? 'real' : 'screen'))
  const [step, setStep] = useState(() => Math.min(7, Math.max(0, load('practiceStep', 2))))
  const [round, setRound] = useState(0) // bump to deal a fresh cube
  const [best, setBest] = useState<Record<number, number>>(() => load('practiceBest', {}))
  const [real, setReal] = useState<Record<number, boolean>>(() => load('practiceReal', {}))
  useEffect(() => { save('practiceMode', mode); save('practiceStep', step) }, [mode, step])

  const choose = (k: number) => { setStep(k); setRound(r => r + 1) }
  const again = () => setRound(r => r + 1)
  const next = step < 7 ? () => choose(step + 1) : undefined
  const top = (
    <>
      <header className="page-head">
        <h1>Practice</h1>
        <p className="lede">Pick a step and drill it until it feels automatic. Use the cube on screen, or set up your own cube with a few moves and solve it in your hands.</p>
      </header>
      <div className="mode-switch" role="radiogroup" aria-label="Where to practice">
        {([['screen', 'On screen'], ['real', 'On my real cube']] as const).map(([m, label]) => (
          <button key={m} role="radio" aria-checked={mode === m} onClick={() => { setMode(m); again() }}>{label}</button>
        ))}
      </div>
      <ol className="practice-steps" aria-label="Choose a step">
        {STAGES.map((s, k) => (
          <li key={k}>
            <button className={k === step ? 'on' : ''} aria-current={k === step ? 'step' : undefined} onClick={() => choose(k)}>
              <Mini pattern={STEP_ART[k].pattern} label={`${s.title} target`} />
              <span className="ps-title"><b>{k + 1}</b> {s.title}</span>
              <span className="ps-badges">
                <Stars n={best[k] ?? 0} />
                {real[k] && <span className="real-badge" title="Checked on your real cube"><Icon name="check" size={12} /> real</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </>
  )
  const props = { step, top, again, next }
  const key = `${mode}-${step}-${round}`
  return mode === 'screen'
    ? <OnScreen key={key} {...props} onStars={n => setBest(b => { const nb = { ...b, [step]: Math.max(b[step] ?? 0, n) }; save('practiceBest', nb); return nb })} />
    : <RealCube key={key} {...props} onVerified={() => setReal(r => { const nr = { ...r, [step]: true }; save('practiceReal', nr); return nr })} />
}

type ModeProps = { step: number; top: ReactNode; again: () => void; next?: () => void }

// A real cube at the start of step k: scramble, run the guide up to step k, use its move count as par
function screenChallenge(step: number) {
  for (;;) {
    const s0 = move(SOLVED, scramble())
    const plan = solve(s0)
    const algs = (k: number) => plan[k].flatMap(ch => ch.lines.map(l => l.alg)).join(' ')
    const start = plan.slice(0, step).reduce((s, _, k) => move(s, algs(k)), s0)
    const par = toMoves(algs(step)).length
    if (par) return { start, par }
  }
}

function Hints({ step, from, chunks }: { step: number; from: State; chunks: ReturnType<typeof solve>[number] | null }) {
  const [level, setLevel] = useState(0) // 1 what to look for, 2 which piece, 3+ reveal the guide's moves part by part
  const next = chunks?.[0]
  const lines = chunks?.flatMap(ch => ch.lines) ?? []
  const shown = Math.max(0, level - 2)
  const starts = lines.reduce<State[]>((acc, l) => [...acc, move(acc.at(-1)!, l.alg)], [from])
  return (
    <section className="panel hints">
      <div className="pad-head">
        <h2><Icon name="bulb" size={22} /> Hints</h2>
        {(level < 2 || shown < lines.length) && <button className="btn small" onClick={() => setLevel(level + 1)}>{level === 0 ? 'Show a hint' : level < 2 ? 'Another hint' : 'Reveal the next moves'}</button>}
      </div>
      {!chunks && <p className="bad">An earlier step came undone. Undo your last few moves, or start over.</p>}
      {level === 0 && chunks && <p className="note">Each hint is more specific than the last. Try to get there with as few as you can.</p>}
      {level >= 1 && <p><b>What to look for:</b> {STAGES[step].look}</p>}
      {level >= 2 && next && <p><b>Work on:</b> {next.title.replace(/^./, c => c.toLowerCase())}.</p>}
      {lines.slice(0, shown).map((l, i) => (
        <div key={i} className="hint-moves">
          <Tiles alg={l.alg} colors={colorsAlong(starts[i], l.alg)} />
          <p>{l.note}</p>
        </div>
      ))}
    </section>
  )
}

function OnScreen({ step, top, again, next, onStars }: ModeProps & { onStars: (n: number) => void }) {
  const cube = useRef<Cube3D>(null)
  const [ch] = useState(() => screenChallenge(step))
  const [seq, setSeq] = useState<string[]>([])
  const [helped, setHelped] = useState(false)
  const cur = useMemo(() => move(ch.start, seq.join(' ')), [seq])
  const done = seq.length > 0 && stageDone(step, cur)
  const stars = starsFor(seq.length, ch.par, helped)
  const chunks = useMemo(() => { if (done) return null; const plan = solve(cur); return plan.some((p, k) => k < step && p.length) ? null : plan[step] }, [cur, done])
  useEffect(() => { if (done) { cube.current?.spin(); onStars(stars) } }, [done])

  const turn = (m: string) => { if (done) return; setSeq(s => [...s, m]); cube.current?.play(m, 380) }
  const undo = () => { const m = seq.at(-1); if (!m || done) return; setSeq(s => s.slice(0, -1)); cube.current?.play(invertMove(m), 300) }
  const reset = () => { setSeq([]); setHelped(false); cube.current?.setState(ch.start) }
  const showMe = () => {
    const l = chunks?.[0]?.lines[0]
    if (!l) return
    setHelped(true)
    setSeq(s => [...s, ...toMoves(l.alg)])
    toMoves(l.alg).forEach(m => cube.current?.play(m, 480))
  }
  const last = seq.at(-1)
  return (
    <div className="split practice">
      <article className="lesson">
        {top}
        <section className={'panel challenge' + (done ? ' won' : '')} aria-live="polite">
          {done && <Confetti />}
          <ChallengeHead step={step} />
          <div className="score">
            <span className="chip">Your moves <b>{seq.length}</b></span>
            <span className="chip">Par <b>{ch.par}</b></span>
            {helped && <span className="chip muted">Used "show me"</span>}
          </div>
          {done ? (
            <Win step={step} again={again} next={next}>
              <Stars n={stars} />
              <p>{helped ? 'Done with a little help. Try a fresh one without "show me".' : seq.length <= ch.par ? `${seq.length} moves, at or under par. That's the guide's own count.` : `${seq.length} moves against a par of ${ch.par}. Try another and aim lower.`}</p>
            </Win>
          ) : (
            <>
              <MovePad state={cur} now={last} onMove={turn} />
              <div className="actions">
                <button className="btn white" onClick={undo} disabled={!seq.length}><Icon name="undo" size={18} /> Undo</button>
                <button className="btn ghost" onClick={reset} disabled={!seq.length}><Icon name="reset" size={18} /> Start over</button>
                <button className="btn ghost" onClick={again}>New cube</button>
                {chunks?.[0] && <button className="btn ghost" onClick={showMe}><Icon name="play" size={16} /> Show me the next moves</button>}
              </div>
            </>
          )}
        </section>
        {!done && <Hints step={step} from={cur} chunks={chunks} key={seq.length ? 'live' : 'fresh'} />}
      </article>
      <aside className="stage">
        <div className="stage-card">
          <CubeView cubeRef={cube} initial={ch.start} />
          <div className="say" aria-live="polite">
            {last ? <><Tiles alg={last} colors={[faceColor(move(ch.start, seq.slice(0, -1).join(' ')), last)]} at={0} size="xl" key={seq.length} /><p>{describe(last)}</p></>
              : <p>Your cube for step {step + 1}. Make your first move.</p>}
          </div>
        </div>
      </aside>
    </div>
  )
}

// Real cube: follow short setup moves from a solved cube, solve the step in your hands, optionally check with the camera
function RealCube({ step, top, again, next, onVerified }: ModeProps & { onVerified: () => void }) {
  const cube = useRef<Cube3D>(null)
  const busy = useRef(false)
  const [ch] = useState(() => practiceSetup(step))
  const setup = useMemo(() => toMoves(ch.setup), [])
  const setupColors = useMemo(() => colorsAlong(SOLVED, ch.setup), [])
  const chunks = useMemo(() => solve(ch.start)[step], [])
  const [i, setI] = useState(0)
  const [phase, setPhase] = useState<'setup' | 'solve' | 'won'>('setup')
  const [verified, setVerified] = useState(false)
  const [verdict, setVerdict] = useState('')
  const [scanning, setScanning] = useState(false)
  const [reveal, setReveal] = useState(false)
  const scanned = useRef<State>(SOLVED.map((c, k) => (k % 9 === 4 ? c : '_')))

  const stepSetup = async (dir: 1 | -1, all = false) => {
    if (busy.current || phase !== 'setup') return
    busy.current = true
    let k = i
    do {
      if (dir === 1 ? k >= setup.length : k <= 0) break
      await cube.current?.play(dir === 1 ? setup[k] : invertMove(setup[k - 1]), all ? 200 : 520)
      k += dir
      setI(k)
    } while (all)
    busy.current = false
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') stepSetup(1); else if (e.key === 'ArrowLeft') stepSetup(-1) }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  })
  useEffect(() => { if (phase === 'won') cube.current?.spin() }, [phase])

  // Camera check: the scanned cube must have this step done and every earlier one intact
  const check = () => {
    setScanning(false)
    const s = scanned.current
    if (s.includes('_')) return setVerdict('Scan all six faces to check your cube.')
    const problem = validate(s)
    if (problem) return setVerdict(problem)
    if (stageDone(step, s)) { setVerified(true); setPhase('won'); onVerified(); return }
    setVerdict(step > 0 && !stageDone(step - 1, s) ? `An earlier step came undone (step ${step}). Fix that first, then finish this one.` : `Not quite yet. The goal: ${STAGES[step].goal}`)
  }

  const setupDone = i >= setup.length
  return (
    <div className="split practice">
      <article className="lesson">
        {top}
        <section className={'panel challenge' + (phase === 'won' ? ' won' : '')} aria-live="polite">
          {phase === 'won' && <Confetti />}
          <ChallengeHead step={step} />
          {phase === 'setup' && (
            <div className="setup">
              <p><b>Start with a solved cube</b>, yellow on top and green facing you. Do these {setup.length} moves, one at a time:</p>
              <Tiles alg={ch.setup} colors={setupColors} at={setupDone ? -1 : i} done={i} />
              <div className="actions">
                <button className="btn white icon" onClick={() => stepSetup(-1)} disabled={i === 0} aria-label="Previous setup move (left arrow)"><Icon name="prev" /></button>
                {setupDone
                  ? <button className="btn yellow" onClick={() => setPhase('solve')}>Setup done, start solving <Icon name="arrow" size={18} /></button>
                  : <button className="btn yellow" onClick={() => stepSetup(1)}><Icon name="next" size={18} /> Next move ({i + 1} of {setup.length})</button>}
                {!setupDone && <button className="btn ghost" onClick={() => stepSetup(1, true)}>Play the rest</button>}
              </div>
              <p className="note">No solved cube to hand? Solve one with the guide first, or practice on screen.</p>
            </div>
          )}
          {phase === 'solve' && (
            <div className="setup">
              <p>Now solve <b>step {step + 1}</b> on your cube. The guide does it in <b>{toMoves(chunks.flatMap(c => c.lines.map(l => l.alg)).join(' ')).length} moves</b> from here. Hints are below if you get stuck.</p>
              {verdict && <p className="error" role="alert">{verdict}</p>}
              <div className="actions">
                <button className="btn yellow" onClick={() => { setVerdict(''); setScanning(true) }}><Icon name="camera" size={18} /> Check it with the camera</button>
                <button className="btn white" onClick={() => setPhase('won')}>I've finished</button>
              </div>
            </div>
          )}
          {phase === 'won' && (
            <Win step={step} again={again} next={next} label="Set up another">
              <p>{verified ? `Checked with the camera: step ${step + 1} is done on your real cube.` : `Nice work. The guide's way took ${ch.par} moves from that position.`}</p>
              <button className="btn ghost" onClick={() => setReveal(!reveal)}>{reveal ? "Hide the guide's moves" : "Compare with the guide's moves"}</button>
              {reveal && chunks.flatMap(c => c.lines).map((l, k, all) => (
                <div key={k} className="hint-moves">
                  <Tiles alg={l.alg} colors={colorsAlong(all.slice(0, k).reduce((s, x) => move(s, x.alg), ch.start), l.alg)} />
                  <p>{l.note}</p>
                </div>
              ))}
            </Win>
          )}
        </section>
        {phase === 'solve' && <Hints step={step} from={ch.start} chunks={chunks} />}
        {scanning && (
          <Scanner start="F" onClose={check} finish={['All six faces are in. Close this to see whether the step is done.', 'Check my step']}
            onFaces={faces => { scanned.current = scanned.current.map((c, k) => faces[FACES[(k / 9) | 0]]?.[k % 9] ?? c) }} />
        )}
      </article>
      <aside className="stage">
        <div className="stage-card">
          <CubeView cubeRef={cube} initial={SOLVED} />
          <div className="say" aria-live="polite">
            {phase === 'setup' && !setupDone
              ? <><Tiles alg={setup[i]} colors={[setupColors[i]]} at={0} size="xl" key={i} /><p>{describe(setup[i])}</p></>
              : phase === 'setup' ? <p>Your cube should now look like this. Drag to compare every side.</p>
              : phase === 'solve' ? <p>Your starting position for step {step + 1}. Drag to look around.</p>
              : <p>Step {step + 1} done.</p>}
          </div>
        </div>
      </aside>
    </div>
  )
}

function ChallengeHead({ step }: { step: number }) {
  return (
    <div className="challenge-head">
      <span className="step-badge">{step + 1}</span>
      <div>
        <h2>{STAGES[step].title}</h2>
        <p>{STAGES[step].goal}</p>
      </div>
    </div>
  )
}

function Win({ step, again, next, label = 'Another one', children }: { step: number; again: () => void; next?: () => void; label?: string; children: ReactNode }) {
  return (
    <div className="win">
      <span className="stamp">Step done</span>
      {children}
      <div className="actions">
        <button className="btn yellow" onClick={again}>{label} <Icon name="arrow" size={18} /></button>
        {next && <button className="btn white" onClick={next}>Next step: {STAGES[step + 1].title}</button>}
      </div>
    </div>
  )
}
