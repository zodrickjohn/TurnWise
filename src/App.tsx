import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { flushSync } from 'react-dom'
import { SOLVED, cornersOnly, type Size, type State } from './cube/model.ts'
import { solve, timeline, type Chunk, type Diagnosis } from './cube/solver.ts'
import { normalizeAny, prepareAny, validateAny } from './cube/bigsolve.ts'
import { LEVELS, type Level } from './cube/methods.ts'
import { ask } from './cube/ask.ts'
import { bigCube } from './cube/big.ts'
import { Icon, colorName, load, reduceMotion, save, toTop } from './ui.tsx'
import { themeShow } from './themeShow.ts'
import Home from './views/Home.tsx'
import Learn from './views/Learn.tsx'
import Input from './views/Input.tsx'
import Solve, { type Fix } from './views/Solve.tsx'
import Practice from './views/Practice.tsx'
import Patterns from './views/Patterns.tsx'

export type View = 'home' | 'learn' | 'input' | 'solve' | 'practice' | 'patterns'
export type Puzzle = { start: State; plan: Chunk[][]; size: Size; level: Level }
type Theme = 'light' | 'dark'
// Empty paint boards: odd cubes keep their fixed centers, 2×2 and 4×4 start fully blank
const BLANKS: Record<Size, State> = {
  2: SOLVED.map(() => '_'),
  3: SOLVED.map((c, i) => (i % 9 === 4 ? c : '_')),
  4: bigCube(4).SOLVED.map(() => '_'),
  5: bigCube(5).SOLVED.map((c, i) => (i % 25 === 12 ? c : '_')),
}
const SIZES: Size[] = [2, 3, 4, 5]
const sizeOf = (v: unknown): Size => (SIZES.includes(v as Size) ? (v as Size) : 3)
const isCube = (s: unknown, size: Size): s is State => Array.isArray(s) && s.length === BLANKS[size].length && s.every(c => typeof c === 'string' && 'wyrogb_'.includes(c))
const PAINT_KEY = (n: Size) => (n === 3 ? 'paint' : 'paint' + n)

const levelOf = (v: unknown): Level => (LEVELS.includes(v as Level) ? (v as Level) : 'beginner')
// Rebuild a saved puzzle only if it is still a valid cube; plans that take time to make (big cubes, other levels) are kept as saved
function restorePuzzle(): Puzzle | null {
  const start = load<unknown>('start', null), size = sizeOf(load('startSize', 3)), level = levelOf(load('startLevel', 'beginner')), plan = load<Chunk[][] | null>('plan', null)
  try {
    if (!isCube(start, size) || validateAny(start, size)) return null
    if (Array.isArray(plan)) return { start, plan, size, level }
    return size > 3 || level !== 'beginner' ? null : { start, plan: solve(start, size), size, level }
  } catch { return null }
}

// Each page has its own address, so Back, Forward and refresh land where people expect
const ROUTE: Record<View, string> = { home: '', learn: 'learn', input: 'paint', solve: 'solve', practice: 'practice', patterns: 'patterns' }
const fromHash = (): View => (Object.keys(ROUTE) as View[]).find(v => ROUTE[v] && location.hash === '#/' + ROUTE[v]) ?? 'home'
const urlOf = (v: View) => (ROUTE[v] ? '#/' + ROUTE[v] : location.pathname + location.search)
const JOURNEY: [View, string, string][] = [['learn', 'Learn the moves', 'Learn'], ['input', 'Paint your cube', 'Paint'], ['solve', 'Solve it', 'Solve'], ['practice', 'Practice', 'Practice']]

export default function App() {
  const [size, setSize] = useState<Size>(() => sizeOf(load('size', 3))) // the cube being painted or practiced
  const [level, setLevel] = useState<Level>(() => levelOf(load('level', 'beginner'))) // how the next solve is taught
  useEffect(() => { save('level', level) }, [level])
  const [paints, setPaints] = useState(() => Object.fromEntries(SIZES.map(n => { const p = load<unknown>(PAINT_KEY(n), null); return [n, isCube(p, n) ? p : BLANKS[n]] })) as Record<Size, State>)
  const setPaintOf = (n: Size) => (u: State | ((p: State) => State)) => setPaints(all => ({ ...all, [n]: typeof u === 'function' ? u(all[n]) : u }))
  const [puzzle, setPuzzle] = useState<Puzzle | null>(restorePuzzle)
  const [view, setView] = useState<View>(() => { const v = fromHash(); return v === 'solve' && !puzzle ? 'home' : v }) // a refresh keeps the page
  const [visited, setVisited] = useState<Set<View>>(() => new Set(load<View[]>('visited', [])))
  const [repair, setRepair] = useState<number | null>(null) // solve position being checked against the real cube
  const [fix, setFix] = useState<Fix>()
  const [notice, setNotice] = useState<string>()
  const [session, setSession] = useState(0)
  const [theme, setTheme] = useState<Theme>(() => load<Theme>('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))
  useEffect(() => { SIZES.forEach(n => save(PAINT_KEY(n), paints[n])); save('size', size) }, [paints, size])
  useEffect(() => { save('start', puzzle?.start ?? null); save('startSize', puzzle?.size ?? 3); save('startLevel', puzzle?.level ?? 'beginner'); save('plan', puzzle && (puzzle.size > 3 || puzzle.level !== 'beginner') ? puzzle.plan : null) }, [puzzle])
  // While repairing, the paint screen shows the solve's size
  const paintSize = repair !== null && puzzle ? puzzle.size : size
  const paint = paints[paintSize], setPaint = setPaintOf(paintSize)
  useEffect(() => { save('visited', [...visited]) }, [visited])
  useEffect(() => { document.documentElement.dataset.theme = theme; save('theme', theme) }, [theme])

  // Page changes cross-fade via the View Transitions API where supported
  // back: set when the browser moved through history (Back / Forward); the page then returns to where it was scrolled
  const scrollBack = useRef(0)
  const go = (v: View, then?: () => void, back?: { y: number }) => {
    if (!back) {
      if (v === view && !then) return
      history.replaceState({ ...history.state, view, y: scrollY }, '') // remember where this page was scrolled
      if (v !== view) history.pushState({ view: v }, '', urlOf(v))
    }
    scrollBack.current = back?.y ?? 0
    const swap = () => flushSync(() => {
      if (view === 'solve') { setFix(undefined); setNotice(undefined) } // one-time messages end when leaving the solve
      then?.()
      setView(v)
      setVisited(s => new Set(s).add(view))
    })
    document.startViewTransition ? document.startViewTransition(swap) : swap()
  }
  useEffect(() => { const y = scrollBack.current; requestAnimationFrame(() => toTop(y)) }, [view])
  // Back and Forward: show the page in the address; leaving the slip check ends it. A dialog's own entry is the dialog's business
  const latest = useRef({ go, view, puzzle })
  latest.current = { go, view, puzzle }
  useEffect(() => {
    history.replaceState({ view }, '', urlOf(view))
    const pop = (e: PopStateEvent) => {
      const { go, view, puzzle } = latest.current
      let v = fromHash()
      if (e.state?.modal || v === view) return
      if (v === 'solve' && !puzzle) { v = 'home'; history.replaceState({ view: v }, '', urlOf(v)) }
      go(v, () => setRepair(null), { y: e.state?.y ?? 0 })
    }
    addEventListener('popstate', pop)
    return () => removeEventListener('popstate', pop)
  }, [])

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

  const plan = (cube: State, n: Size, l: Level) => ask<ReturnType<typeof prepareAny>>({ kind: 'plan', cube, size: n, level: l }).then(p => ({ ...p, size: n, level: l }))
  // The same cube taught another way, from the solve screen
  const replan = (l: Level) => puzzle && plan(puzzle.start, puzzle.size, l).then(p => { setLevel(l); openSolve(p) })

  // Paint screen submit: a new cube, or the real cube checked against the solve in progress
  const submit = async (actual: State) => {
    if (repair === null || !puzzle) return openSolve(await plan(actual, size, level))
    const n = puzzle.size, { states } = timeline(puzzle.start, puzzle.plan, n)
    const d = await ask<Diagnosis>({ kind: 'diagnose', start: puzzle.start, plan: puzzle.plan, pos: repair, actual, size: n })
    if (d.kind === 'new') return openSolve(await plan(actual, n, puzzle.level), undefined,
      "Your cube didn't match any point in the plan, so here's a fresh one from where your cube is now. Finished steps are skipped." + (n === 3 ? ' Hold yellow on top and green facing you.' : ''))
    const hold = n === 3 ? ` Hold your cube with yellow on top and ${colorName(states[d.at][22])} facing you.` : ' Hold your cube the way the screen shows it.'
    const gap = Math.abs(repair - d.at)
    save('pos', { key: puzzle.start.join('') + puzzle.level, pos: d.at })
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
          <Input paint={paint} setPaint={setPaint} blank={BLANKS[paintSize]} onSubmit={submit} size={paintSize}
            setSize={repair === null ? setSize : undefined} level={level} setLevel={repair === null ? setLevel : undefined}
            repair={repair !== null ? () => go('solve', () => setRepair(null)) : undefined} />
        )}
        {view === 'solve' && puzzle && (
          <Solve key={`${puzzle.start.join('')}-${session}`} puzzle={puzzle} fix={fix} notice={notice} onLevel={replan}
            again={() => go('input', () => { setSize(puzzle.size); setPaintOf(puzzle.size)(BLANKS[puzzle.size]); setRepair(null) })}
            practice={() => go('practice')} patterns={() => go('patterns')}
            onMismatch={(expected, pos) => go('input', () => { setPaintOf(puzzle.size)(puzzle.size === 2 ? cornersOnly(expected) : normalizeAny(expected, puzzle.size)); setRepair(pos) })} />
        )}
        {view === 'patterns' && <Patterns go={go} />}
        {view === 'practice' && <Practice key={size} size={size} setSize={setSize} painted={validateAny(paints[size], size) ? undefined : paints[size]} />}
      </main>
    </>
  )
}
