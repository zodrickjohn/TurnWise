import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { flushSync } from 'react-dom'
import { SOLVED, cornersOnly, type Size, type State } from './cube/model.ts'
import { diagnose, normalize, prepare, solve, timeline, validate, type Chunk } from './cube/solver.ts'
import { Icon, colorName, load, reduceMotion, save, toTop } from './ui.tsx'
import { themeShow } from './themeShow.ts'
import Home from './views/Home.tsx'
import Learn from './views/Learn.tsx'
import Input from './views/Input.tsx'
import Solve, { type Fix } from './views/Solve.tsx'
import Practice from './views/Practice.tsx'

export type View = 'home' | 'learn' | 'input' | 'solve' | 'practice'
export type Puzzle = { start: State; plan: Chunk[][]; size: Size }
type Theme = 'light' | 'dark'
const BLANK = SOLVED.map((c, i) => (i % 9 === 4 ? c : '_'))
const BLANK2 = SOLVED.map(() => '_')
const sizeOf = (v: unknown): Size => (v === 2 ? 2 : 3)
const isCube = (s: unknown): s is State => Array.isArray(s) && s.length === 54 && s.every(c => typeof c === 'string' && 'wyrogb_'.includes(c))

// Rebuild a saved puzzle only if it is still a valid cube
function restorePuzzle(): Puzzle | null {
  const start = load<unknown>('start', null), size = sizeOf(load('startSize', 3))
  try { return isCube(start) && !validate(start, size) ? { start, plan: solve(start, size), size } : null } catch { return null }
}
const JOURNEY: [View, string, string][] = [['learn', 'Learn the moves', 'Learn'], ['input', 'Paint your cube', 'Paint'], ['solve', 'Solve it', 'Solve'], ['practice', 'Practice', 'Practice']]

export default function App() {
  const [view, setView] = useState<View>('home')
  const [size, setSize] = useState<Size>(() => sizeOf(load('size', 3))) // the cube being painted or practiced
  const [paint3, setPaint3] = useState<State>(() => { const p = load<unknown>('paint', BLANK); return isCube(p) ? p : BLANK })
  const [paint2, setPaint2] = useState<State>(() => { const p = load<unknown>('paint2', BLANK2); return isCube(p) ? p : BLANK2 })
  const [puzzle, setPuzzle] = useState<Puzzle | null>(restorePuzzle)
  const [visited, setVisited] = useState<Set<View>>(() => new Set(load<View[]>('visited', [])))
  const [repair, setRepair] = useState<number | null>(null) // solve position being checked against the real cube
  const [fix, setFix] = useState<Fix>()
  const [notice, setNotice] = useState<string>()
  const [session, setSession] = useState(0)
  const [theme, setTheme] = useState<Theme>(() => load<Theme>('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))
  useEffect(() => { save('paint', paint3); save('paint2', paint2); save('size', size) }, [paint3, paint2, size])
  useEffect(() => { save('start', puzzle?.start ?? null); save('startSize', puzzle?.size ?? 3) }, [puzzle])
  // While repairing, the paint screen shows the solve's size
  const paintSize = repair !== null && puzzle ? puzzle.size : size
  const [paint, setPaint] = paintSize === 2 ? [paint2, setPaint2] : [paint3, setPaint3]
  useEffect(() => { save('visited', [...visited]) }, [visited])
  useEffect(() => { document.documentElement.dataset.theme = theme; save('theme', theme) }, [theme])

  // Page changes cross-fade via the View Transitions API where supported
  const go = (v: View, then?: () => void) => {
    const swap = () => flushSync(() => {
      if (view === 'solve') { setFix(undefined); setNotice(undefined) } // one-time messages end when leaving the solve
      then?.()
      setView(v)
      setVisited(s => new Set(s).add(view))
    })
    document.startViewTransition ? document.startViewTransition(swap) : swap()
  }
  useEffect(() => { toTop() }, [view])

  // Theme = time of day. A click lets the CSS --t value travel to noon or night (sunset or sunrise);
  // dragging the toggle sideways scrubs --t directly, and letting go settles on the nearer end
  const drag = useRef<{ x: number; t: number; moved: boolean } | null>(null)
  const justScrubbed = useRef(false) // swallows the click that follows a drag
  const setDayNight = (next: Theme) => { document.documentElement.dataset.theme = next; setTheme(next) }
  const scrubStart = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    justScrubbed.current = false
    drag.current = { x: e.clientX, t: theme === 'dark' ? 1 : 0, moved: false }
  }
  const scrubMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d || (!d.moved && Math.abs(e.clientX - d.x) < 5)) return
    d.moved = true
    const root = document.documentElement
    root.classList.add('scrubbing')
    root.style.setProperty('--t', String(Math.min(1, Math.max(0, d.t + (d.x - e.clientX) / 220)))) // drag left toward night
  }
  const scrubEnd = () => {
    const d = drag.current
    drag.current = null
    if (!d?.moved) return
    const root = document.documentElement
    const t = parseFloat(root.style.getPropertyValue('--t'))
    root.style.removeProperty('--t')
    root.classList.remove('scrubbing')
    setDayNight(t > 0.5 ? 'dark' : 'light') // the transition carries --t from where it was let go
    justScrubbed.current = true
  }
  // A click plays the show: Cubie kicks the sun (or moon) away and the sky changes at the moment of the kick
  const toggleTheme = (e: MouseEvent<HTMLButtonElement>) => {
    if (justScrubbed.current) return void (justScrubbed.current = false)
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    if (reduceMotion) return setDayNight(next)
    themeShow(e.currentTarget, next === 'dark', () => setDayNight(next))
  }

  const openSolve = (p: Puzzle, f?: Fix, n?: string) => go('solve', () => { setPuzzle(p); setFix(f); setNotice(n); setRepair(null); setSession(x => x + 1) })

  // Paint screen submit: a new cube, or the real cube checked against the solve in progress
  const submit = (actual: State) => {
    if (repair === null || !puzzle) return openSolve({ ...prepare(actual, size), size })
    const { states } = timeline(puzzle.start, puzzle.plan)
    const d = diagnose(states, repair, actual, puzzle.size)
    const grip = puzzle.size === 2 ? ' Keep holding your cube the way you painted it.' : ''
    if (d.kind === 'new') return openSolve({ ...prepare(actual, puzzle.size), size: puzzle.size }, undefined,
      "Your cube didn't match any point in the plan, so here's a fresh one from where your cube is now. Finished steps are skipped." + (grip || ' Hold yellow on top and green facing you.'))
    const hold = grip || ` Hold your cube with yellow on top and ${colorName(states[d.at][22])} facing you.`
    const gap = Math.abs(repair - d.at)
    save('pos', { key: puzzle.start.join(''), pos: d.at })
    openSolve(puzzle, d.kind === 'slip' ? { at: d.at, wrong: d.wrong! } : undefined,
      d.kind === 'same' ? `Your cube matches the screen. Carry on from move ${d.at + 1}.${hold}`
        : d.kind === 'jump' ? `Found it: your cube is ${gap} move${gap > 1 ? 's' : ''} ${d.at < repair ? 'behind' : 'ahead of'} the screen, at move ${d.at + 1}. The guide has moved there.${hold}`
        : `Found it: near move ${d.at + 1} your cube got an extra ${d.wrong} turn. Play the fix to undo it, then carry on.${hold}`)
  }

  return (
    <>
      <header className="bar">
        <button className="brand" onClick={() => go('home')} aria-label="Turnwise home">
          <span className="mark" aria-hidden>{['y', 'o', 'g', 'b', 'w', 'r', 'g', 'y', 'o'].map((c, i) => <i key={i} className={'c-' + c} />)}</span>
          <span>Turnwise</span>
        </button>
        <nav aria-label="Your journey">
          <ol className="journey">
            {JOURNEY.map(([v, label, short], i) => (
              <li key={v} className={view === v ? 'on' : visited.has(v) ? 'seen' : ''}>
                <button aria-current={view === v ? 'step' : undefined} disabled={v === 'solve' && !puzzle} onClick={() => go(v, () => v === 'input' && setRepair(null))}>
                  <span className="num">{visited.has(v) && view !== v ? <Icon name="check" size={14} /> : i + 1}</span>
                  <span className="label">{label}</span><span className="label-short">{short}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <button className="theme-toggle" onClick={toggleTheme} onPointerDown={scrubStart} onPointerMove={scrubMove} onPointerUp={scrubEnd} onPointerCancel={scrubEnd}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          <Icon name="sun" size={22} className="sun" />
          <Icon name="moon" size={22} className="moon" />
        </button>
        <span className="scrub-hint" aria-hidden="true">Click, or drag sideways to set the time of day</span>
      </header>
      <main className={'view-' + view}>
        {view === 'home' && <Home go={go} resume={!!puzzle} />}
        {view === 'learn' && <Learn go={go} />}
        {view === 'input' && (
          <Input paint={paint} setPaint={setPaint} blank={paintSize === 2 ? BLANK2 : BLANK} onSubmit={submit} size={paintSize}
            setSize={repair === null ? setSize : undefined}
            repair={repair !== null ? () => go('solve', () => setRepair(null)) : undefined} />
        )}
        {view === 'solve' && puzzle && (
          <Solve key={`${puzzle.start.join('')}-${session}`} puzzle={puzzle} fix={fix} notice={notice}
            again={() => go('input', () => { setSize(puzzle.size); puzzle.size === 2 ? setPaint2(BLANK2) : setPaint3(BLANK); setRepair(null) })}
            practice={() => go('practice')}
            onMismatch={(expected, pos) => go('input', () => { puzzle.size === 2 ? setPaint2(cornersOnly(expected)) : setPaint3(normalize(expected)); setRepair(pos) })} />
        )}
        {view === 'practice' && <Practice key={size} size={size} setSize={setSize} painted={paint3.includes('_') || validate(paint3) ? undefined : paint3} />}
      </main>
    </>
  )
}
