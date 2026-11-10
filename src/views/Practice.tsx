import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Cube3D } from '../cube/Cube3D.ts'
import { FACES, invertMove, move, toMoves, type Size, type State } from '../cube/model.ts'
import { bigCube } from '../cube/big.ts'
import type { Chunk } from '../cube/solver.ts'
import { stageDoneAny, validateAny, type Task } from '../cube/bigsolve.ts'
import { ask } from '../cube/ask.ts'
import { Confetti, CubeView, Icon, LEVEL_NAME, Mini, MovePad, Tiles, describe, faceColor, kitFor, load, save, type Kit } from '../ui.tsx'
import type { Level } from '../cube/methods.ts'
import Scanner from './Scanner.tsx'
import { Coach } from '../Coach.tsx'

type Mode = 'screen' | 'real'
type Deal = { start: State; par: number }
type Setup = Deal & { setup: string }
const SIZES: Size[] = [2, 3, 4, 5]
const METHODS: Level[] = ['beginner', 'intermediate'] // expert moves are computer-found, nothing to drill
const turnFor = (size: Size) => (size > 3 ? bigCube(size).move : move)
const colorsAlong = (size: Size, s: State, alg: string) => toMoves(alg).reduce<[State, string[]]>(([st, cs], m) => [turnFor(size)(st, m), [...cs, faceColor(st, m)]], [s, []])[1]
const algsOf = (chunks: Chunk[]) => chunks.flatMap(c => c.lines.map(l => l.alg)).join(' ')
const starsFor = (moves: number, par: number, helped: boolean) => (helped ? 1 : moves <= par ? 3 : moves <= par * 1.6 ? 2 : 1)

// Ask the solver; the answer is undefined while it works (a 5×5 can take a second or two)
function useAnswer<T>(task: Task | null, deps: unknown[]): [T | undefined, string] {
  const [got, setGot] = useState<{ v?: T; err: string }>({ err: '' })
  useEffect(() => {
    setGot({ err: '' })
    if (!task) return
    let live = true
    ask<T>(task).then(v => live && setGot({ v, err: '' }), e => live && setGot({ err: (e as Error).message }))
    return () => { live = false }
  }, deps)
  return [got.v, got.err]
}

function Stars({ n }: { n: number }) {
  return <span className="stars" role="img" aria-label={`${n} of 3 stars`}>{[0, 1, 2].map(i => <i key={i} className={i < n ? 'on' : ''} />)}</span>
}

// Shared shell: header, size and mode switches and the step picker on the left, the mode's cube on the right
// painted: a complete, valid cube of this size from the paint screen, offered as a starting point for real-cube practice
type Props = { painted?: State; size: Size; setSize: (s: Size) => void }
export default function Practice(props: Props) {
  const [level, setLevel] = useState<Level>(() => (load<string>('practiceLevel', 'beginner') === 'intermediate' ? 'intermediate' : 'beginner'))
  return <Drills key={level} {...props} level={level} setLevel={l => { save('practiceLevel', l); setLevel(l) }} />
}

function Drills({ painted, size, setSize, level, setLevel }: Props & { level: Level; setLevel: (l: Level) => void }) {
  const K = kitFor(size, level), last = K.stages.length - 1, tag = (size === 3 ? '' : String(size)) + (level === 'beginner' ? '' : 'i') // each size and method keeps its own progress
  const [mode, setMode] = useState<Mode>(() => (load<string>('practiceMode', 'screen') === 'real' ? 'real' : 'screen'))
  const [step, setStep] = useState(() => Math.min(last, Math.max(0, load('practiceStep' + tag, size === 3 && level === 'beginner' ? 2 : 0))))
  const [round, setRound] = useState(0) // bump to deal a fresh cube
  const [best, setBest] = useState<Record<number, number>>(() => load('practiceBest' + tag, {}))
  const [real, setReal] = useState<Record<number, boolean>>(() => load('practiceReal' + tag, {}))
  useEffect(() => { save('practiceMode', mode); save('practiceStep' + tag, step) }, [mode, step])

  const choose = (k: number) => { setStep(k); setRound(r => r + 1) }
  const again = () => setRound(r => r + 1)
  const next = step < last ? () => choose(step + 1) : undefined
  const top = (
    <>
      <header className="page-head">
        <h1>Practice</h1>
        <p className="lede">Pick a step and drill it until it feels automatic. Use the cube on screen, or set up your own cube with a few moves and solve it in your hands.</p>
      </header>
      <div className="practice-switches">
        <div className="mode-switch" role="radiogroup" aria-label="Cube size">
          {SIZES.map(n => <button key={n} role="radio" aria-checked={size === n} onClick={() => setSize(n)}>{n}×{n}</button>)}
        </div>
        <div className="mode-switch" role="radiogroup" aria-label="Method">
          {METHODS.map(l => <button key={l} role="radio" aria-checked={level === l} onClick={() => setLevel(l)}>{LEVEL_NAME[l]}</button>)}
        </div>
        <div className="mode-switch" role="radiogroup" aria-label="Where to practice">
          {([['screen', 'On screen'], ['real', 'On my real cube']] as const).map(([m, label]) => (
            <button key={m} role="radio" aria-checked={mode === m} onClick={() => { setMode(m); again() }}>{label}</button>
          ))}
        </div>
      </div>
      <ol className="practice-steps" aria-label="Choose a step">
        {K.stages.map((s, k) => (
          <li key={k}>
            <button className={k === step ? 'on' : ''} aria-current={k === step ? 'step' : undefined} onClick={() => choose(k)}>
              <Mini pattern={K.art[k].pattern} label={`${s.title} target`} />
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
  const props = { step, top, again, next, size, K, level }
  const key = `${mode}-${step}-${round}`
  return mode === 'screen'
    ? <OnScreen key={key} {...props} onStars={n => setBest(b => { const nb = { ...b, [step]: Math.max(b[step] ?? 0, n) }; save('practiceBest' + tag, nb); return nb })} />
    : <RealCube key={key} {...props} painted={painted} onVerified={() => setReal(r => { const nr = { ...r, [step]: true }; save('practiceReal' + tag, nr); return nr })} />
}

type ModeProps = { step: number; top: ReactNode; again: () => void; next?: () => void; size: Size; K: Kit; level: Level }

// While the solver deals a cube: the shell stays, the panel says what's happening
function Dealing({ top, step, K, size, error, again }: ModeProps & { error: string }) {
  return (
    <div className="split practice">
      <article className="lesson">
        {top}
        <section className="panel challenge" aria-live="polite">
          <ChallengeHead step={step} info={K.stages[step]} />
          {error ? <><p className="error" role="alert">{error}</p><button className="btn yellow" onClick={again}>Try again</button></> : <p className="note">Dealing a {size}×{size} for this step…</p>}
        </section>
      </article>
      <aside className="stage"><div className="stage-card"><CubeView cubeRef={{ current: null }} initial={K.solved} size={size} /></div></aside>
    </div>
  )
}

// chunks: undefined while the guide is working them out, null when an earlier step came undone
function Hints({ look, from, chunks, size, onNeed }: { look: string; from: State; chunks: Chunk[] | null | undefined; size: Size; onNeed: () => void }) {
  const [level, setLevel] = useState(0) // 1 what to look for, 2 which piece, 3+ reveal the guide's moves part by part
  const nextChunk = chunks?.[0]
  const lines = chunks?.flatMap(ch => ch.lines) ?? []
  const shown = Math.max(0, level - 2)
  const starts = lines.reduce<State[]>((acc, l) => [...acc, turnFor(size)(acc.at(-1)!, l.alg)], [from])
  const more = () => { setLevel(level + 1); if (level >= 1) onNeed() }
  return (
    <section className="panel hints">
      <div className="pad-head">
        <h2><Icon name="bulb" size={22} /> Hints</h2>
        {(level < 2 || chunks === undefined || shown < lines.length) && <button className="btn small" onClick={more}>{level === 0 ? 'Show a hint' : level < 2 ? 'Another hint' : 'Reveal the next moves'}</button>}
      </div>
      {chunks === null && <p className="bad">An earlier step came undone. Undo your last few moves, or start over.</p>}
      {level === 0 && chunks !== null && <p className="note">Each hint is more specific than the last. Try to get there with as few as you can.</p>}
      {level >= 1 && <p><b>What to look for:</b> {look}</p>}
      {level >= 2 && chunks === undefined && <p className="note">Working out the next moves…</p>}
      {level >= 2 && nextChunk && <p><b>Work on:</b> {nextChunk.title.replace(/^./, c => c.toLowerCase())}.</p>}
      {lines.slice(0, shown).map((l, i) => (
        <div key={i} className="hint-moves">
          <Tiles alg={l.alg} colors={colorsAlong(size, starts[i], l.alg)} />
          <p>{l.note}</p>
        </div>
      ))}
    </section>
  )
}

function OnScreen(props: ModeProps & { onStars: (n: number) => void }) {
  const [ch, err] = useAnswer<Deal>({ kind: 'challenge', step: props.step, size: props.size, level: props.level }, [])
  return ch ? <OnScreenGame {...props} ch={ch} /> : <Dealing {...props} error={err} />
}

function OnScreenGame({ step, top, again, next, size, K, level, onStars, ch }: ModeProps & { onStars: (n: number) => void; ch: Deal }) {
  const cube = useRef<Cube3D>(null)
  const turnState = turnFor(size)
  const [seq, setSeq] = useState<string[]>([])
  const [helped, setHelped] = useState(false)
  const [need, setNeed] = useState(size <= 3) // big cubes only ask the guide when a hint needs it
  const [wantShow, setWantShow] = useState(false)
  const cur = useMemo(() => turnState(ch.start, seq.join(' ')), [seq])
  const done = seq.length > 0 && stageDoneAny(step, cur, size, level)
  const stars = starsFor(seq.length, ch.par, helped)
  const [chunks] = useAnswer<Chunk[] | null>(done || !need ? null : { kind: 'chunks', cube: cur, step, size, level }, [cur, need, done])
  useEffect(() => { if (done) { cube.current?.spin(); onStars(stars) } }, [done])

  const turn = (m: string) => { if (done) return; setSeq(s => [...s, m]); cube.current?.play(m, 380) }
  const undo = () => { const m = seq.at(-1); if (!m || done) return; setSeq(s => s.slice(0, -1)); cube.current?.play(invertMove(m), 300) }
  const reset = () => { setSeq([]); setHelped(false); cube.current?.setState(ch.start) }
  const play = (c: Chunk[]) => {
    const l = c[0]?.lines[0]
    if (!l) return
    setHelped(true)
    setSeq(s => [...s, ...toMoves(l.alg)])
    toMoves(l.alg).forEach(m => cube.current?.play(m, 480))
  }
  const showMe = () => (chunks ? play(chunks) : (setNeed(true), setWantShow(true)))
  useEffect(() => { if (wantShow && chunks) { setWantShow(false); play(chunks) } }, [chunks, wantShow])
  const last = seq.at(-1)
  return (
    <div className="split practice">
      <article className="lesson">
        {top}
        <section className={'panel challenge' + (done ? ' won' : '')} aria-live="polite">
          {done && <Confetti />}
          <ChallengeHead step={step} info={K.stages[step]} />
          <div className="score">
            <span className="chip">Your moves <b>{seq.length}</b></span>
            <span className="chip">Par <b>{ch.par}</b></span>
            {helped && <span className="chip muted">Used "show me"</span>}
          </div>
          {done ? (
            <Win again={again} next={next} nextTitle={K.stages[step + 1]?.title}>
              <Stars n={stars} />
              <p>{helped ? 'Done with a little help. Try a fresh one without "show me".' : seq.length <= ch.par ? `${seq.length} moves, at or under par. That's the guide's own count.` : `${seq.length} moves against a par of ${ch.par}. Try another and aim lower.`}</p>
            </Win>
          ) : (
            <>
              <MovePad state={cur} now={last} onMove={turn} size={size} />
              <div className="actions">
                <button className="btn white" onClick={undo} disabled={!seq.length}><Icon name="undo" size={18} /> Undo</button>
                <button className="btn ghost" onClick={reset} disabled={!seq.length}><Icon name="reset" size={18} /> Start over</button>
                <button className="btn ghost" onClick={again}>New cube</button>
                {chunks !== null && <button className="btn ghost" onClick={showMe} disabled={wantShow}><Icon name="play" size={16} /> {wantShow ? 'Working it out…' : 'Show me the next moves'}</button>}
              </div>
            </>
          )}
        </section>
        {!done && <Hints look={K.stages[step].look} from={cur} chunks={need ? chunks : undefined} size={size} onNeed={() => setNeed(true)} key={seq.length ? 'live' : 'fresh'} />}
      </article>
      <aside className="stage">
        <div className="stage-card">
          <CubeView cubeRef={cube} initial={ch.start} size={size} />
          <Coach className="stage-coach" mood={done ? 'cheer' : last ? 'happy' : 'grit'} sayKey={done ? 'won' : seq.length}
            say={done ? (stars === 3 ? 'Three stars! Right on the guide\'s count.' : 'Step done! Want to try for fewer moves?')
              : last ? <span className="say-move"><Tiles alg={last} colors={[faceColor(turnState(ch.start, seq.slice(0, -1).join(' ')), last)]} at={0} size="lg" />{describe(last)}</span>
              : `Your cube for step ${step + 1}. Par is ${ch.par}. You've got this!`} />
        </div>
      </aside>
    </div>
  )
}

function RealCube(props: ModeProps & { painted?: State; onVerified: () => void }) {
  const [deal, err] = useAnswer<Setup>({ kind: 'setup', step: props.step, size: props.size, level: props.level }, [])
  return deal ? <RealCubeGame {...props} deal={deal} /> : <Dealing {...props} error={err} />
}

// Real cube: follow short setup moves from a solved cube, solve the step in your hands, optionally check with the camera
function RealCubeGame({ step, top, again, next, size, K, level, painted, onVerified, deal }: ModeProps & { painted?: State; onVerified: () => void; deal: Setup }) {
  const cube = useRef<Cube3D>(null)
  const busy = useRef(false)
  const [ch, setCh] = useState({ ...deal, from: K.solved, scrambled: false })
  const setup = useMemo(() => toMoves(ch.setup), [ch])
  const setupColors = useMemo(() => colorsAlong(size, ch.from, ch.setup), [ch])
  const [chunks] = useAnswer<Chunk[] | null>({ kind: 'chunks', cube: ch.start, step, size, level }, [ch])
  const [i, setI] = useState(0)
  const [phase, setPhase] = useState<'setup' | 'solve' | 'won'>('setup')
  const [verified, setVerified] = useState(false)
  const [verdict, setVerdict] = useState('')
  const [scanning, setScanning] = useState<'check' | 'source' | null>(null)
  const [reveal, setReveal] = useState(false)
  const scanned = useRef<State>(K.solved)
  const scan = (why: 'check' | 'source') => { scanned.current = K.solved.map((c, k) => (k % K.per === K.fixed ? c : '_')); setVerdict(''); setScanning(why) }

  // Start from the learner's scrambled cube: the guide's earlier steps become the setup
  const startFromScrambled = (cubeNow: State) => {
    const problem = validateAny(cubeNow, size)
    if (problem) return setVerdict(problem)
    setVerdict('Planning the moves to this step…')
    ask<Setup>({ kind: 'from', cube: cubeNow, step, size, level }).then(r => {
      if (!r.par) return setVerdict(`Your cube already has step ${step + 1} done. Pick a later step, or scramble it first.`)
      setCh({ ...r, from: cubeNow, scrambled: true })
      setI(0)
      setVerdict('')
      cube.current?.setState(cubeNow)
    }, e => setVerdict((e as Error).message))
  }

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
    const why = scanning
    setScanning(null)
    const s = scanned.current
    if (s.some((c, k) => c === '_' && (size !== 2 || [0, 2, 6, 8].includes(k % 9)))) return setVerdict(`Scan all six faces to ${why === 'source' ? 'use your cube' : 'check your cube'}.`)
    if (why === 'source') return startFromScrambled(s)
    const problem = validateAny(s, size)
    if (problem) return setVerdict(problem)
    if (stageDoneAny(step, s, size, level)) { setVerified(true); setPhase('won'); onVerified(); return }
    setVerdict(step > 0 && !stageDoneAny(step - 1, s, size, level) ? `An earlier step came undone (step ${step}). Fix that first, then finish this one.` : `Not quite yet. The goal: ${K.stages[step].goal}`)
  }

  const setupDone = i >= setup.length
  const guideMoves = chunks ? toMoves(algsOf(chunks)).length : ch.par
  return (
    <div className="split practice">
      <article className="lesson">
        {top}
        <section className={'panel challenge' + (phase === 'won' ? ' won' : '')} aria-live="polite">
          {phase === 'won' && <Confetti />}
          <ChallengeHead step={step} info={K.stages[step]} />
          {phase === 'setup' && (
            <div className="setup">
              {ch.scrambled
                ? <p><b>From your scrambled cube</b>, held the way you scanned it, do these {setup.length} moves: the guide's steps 1 to {step}. A quick review on the way.</p>
                : <p><b>Start with a solved cube</b>, yellow on top and green facing you. Do these {setup.length} moves, one at a time:</p>}
              <SetupTiles moves={setup} colors={setupColors} at={i} />
              <div className="actions">
                <button className="btn white icon" onClick={() => stepSetup(-1)} disabled={i === 0} aria-label="Previous setup move (left arrow)"><Icon name="prev" /></button>
                {setupDone
                  ? <button className="btn yellow" onClick={() => setPhase('solve')}>Setup done, start solving <Icon name="arrow" size={18} /></button>
                  : <button className="btn yellow" onClick={() => stepSetup(1)}><Icon name="next" size={18} /> Next move ({i + 1} of {setup.length})</button>}
                {!setupDone && <button className="btn ghost" onClick={() => stepSetup(1, true)}>Play the rest</button>}
              </div>
              {verdict && <p className="error" role="alert">{verdict}</p>}
              {!ch.scrambled && (
                <div className="alt-source">
                  <p><b>Cube scrambled?</b> Use it as it is. Turnwise walks you through the earlier steps first, then hands step {step + 1} to you.</p>
                  <div className="row">
                    <button className="btn white small" onClick={() => scan('source')}><Icon name="camera" size={16} /> Scan my scrambled cube</button>
                    {painted && <button className="btn ghost small" onClick={() => startFromScrambled(painted)}>Use the cube from the paint screen</button>}
                  </div>
                </div>
              )}
            </div>
          )}
          {phase === 'solve' && (
            <div className="setup">
              <p>Now solve <b>step {step + 1}</b> on your cube. The guide does it in <b>{guideMoves} moves</b> from here. Hints are below if you get stuck.</p>
              {verdict && <p className="error" role="alert">{verdict}</p>}
              <div className="actions">
                <button className="btn yellow" onClick={() => scan('check')}><Icon name="camera" size={18} /> Check it with the camera</button>
                <button className="btn white" onClick={() => setPhase('won')}>I've finished</button>
              </div>
            </div>
          )}
          {phase === 'won' && (
            <Win again={again} next={next} nextTitle={K.stages[step + 1]?.title} label="Set up another">
              <p>{verified ? `Checked with the camera: step ${step + 1} is done on your real cube.` : `Nice work. The guide's way took ${ch.par} moves from that position.`}</p>
              <button className="btn ghost" onClick={() => setReveal(!reveal)}>{reveal ? "Hide the guide's moves" : "Compare with the guide's moves"}</button>
              {reveal && chunks?.flatMap(c => c.lines).map((l, k, all) => (
                <div key={k} className="hint-moves">
                  <Tiles alg={l.alg} colors={colorsAlong(size, all.slice(0, k).reduce((s, x) => turnFor(size)(s, x.alg), ch.start), l.alg)} />
                  <p>{l.note}</p>
                </div>
              ))}
            </Win>
          )}
        </section>
        {phase === 'solve' && <Hints look={K.stages[step].look} from={ch.start} chunks={chunks} size={size} onNeed={() => {}} />}
        {scanning && (
          <Scanner start="F" size={size} onClose={check} finish={scanning === 'source' ? ['All six faces are in. Turnwise will plan the moves to the start of this step.', 'Use my cube'] : ['All six faces are in. Close this to see whether the step is done.', 'Check my step']}
            onFaces={faces => { scanned.current = scanned.current.map((c, k) => (k % K.per === K.fixed ? c : faces[FACES[(k / K.per) | 0]]?.[k % K.per] ?? c)) }} />
        )}
      </article>
      <aside className="stage">
        <div className="stage-card">
          <CubeView cubeRef={cube} initial={ch.from} size={size} />
          <Coach className="stage-coach" mood={phase === 'won' ? 'cheer' : phase === 'solve' ? 'think' : verdict ? 'oops' : 'happy'} sayKey={`${phase}-${i}-${verdict}`}
            say={phase === 'setup' && !setupDone && setup.length
              ? <span className="say-move"><Tiles alg={setup[i]} colors={[setupColors[i]]} at={0} size="lg" />{describe(setup[i])}</span>
              : phase === 'setup' ? 'Your cube should look like this now. Drag me around to compare every side.'
              : phase === 'solve' ? (verdict ? 'Not quite yet. Keep going, you\'re close!' : `Solve step ${step + 1} in your hands. I'll wait right here.`)
              : `Step ${step + 1} done on your real cube!`} />
        </div>
      </aside>
    </div>
  )
}

// Long setups show a sliding window around the current move instead of a wall of tiles
function SetupTiles({ moves, colors, at }: { moves: string[]; colors: string[]; at: number }) {
  const from = Math.max(0, Math.min(at - 4, moves.length - 24))
  const shown = moves.slice(from, from + 24)
  return (
    <div className="setup-tiles">
      {from > 0 && <span className="more">{from} done</span>}
      <Tiles alg={shown.join(' ')} colors={colors.slice(from, from + 24)} at={at < moves.length ? at - from : -1} done={at - from} />
      {from + 24 < moves.length && <span className="more">+{moves.length - from - 24} more</span>}
    </div>
  )
}

function ChallengeHead({ step, info }: { step: number; info: { title: string; goal: string } }) {
  return (
    <div className="challenge-head">
      <span className="step-badge">{step + 1}</span>
      <div>
        <h2>{info.title}</h2>
        <p>{info.goal}</p>
      </div>
    </div>
  )
}

function Win({ again, next, nextTitle, label = 'Another one', children }: { again: () => void; next?: () => void; nextTitle?: string; label?: string; children: ReactNode }) {
  return (
    <div className="win">
      <span className="stamp">Step done</span>
      {children}
      <div className="actions">
        <button className="btn yellow" onClick={again}>{label} <Icon name="arrow" size={18} /></button>
        {next && <button className="btn white" onClick={next}>Next step: {nextTitle}</button>}
      </div>
    </div>
  )
}
