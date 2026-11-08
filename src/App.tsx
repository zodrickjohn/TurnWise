import { useEffect, useState, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { SOLVED, type State } from './cube/model.ts'
import { diagnose, normalize, solve, timeline, validate, type Chunk } from './cube/solver.ts'
import { Icon, colorName, load, save, stickerWave } from './ui.tsx'
import Home from './views/Home.tsx'
import Learn from './views/Learn.tsx'
import Input from './views/Input.tsx'
import Solve, { type Fix } from './views/Solve.tsx'
import Practice from './views/Practice.tsx'

export type View = 'home' | 'learn' | 'input' | 'solve' | 'practice'
export type Puzzle = { start: State; plan: Chunk[][] }
type Theme = 'light' | 'dark'
const BLANK = SOLVED.map((c, i) => (i % 9 === 4 ? c : '_'))
const isCube = (s: unknown): s is State => Array.isArray(s) && s.length === 54 && s.every(c => typeof c === 'string' && 'wyrogb_'.includes(c))

// Rebuild a saved puzzle only if it is still a valid cube
function restorePuzzle(): Puzzle | null {
  const start = load<unknown>('start', null)
  try { return isCube(start) && !validate(start) ? { start, plan: solve(start) } : null } catch { return null }
}
const JOURNEY: [View, string][] = [['learn', 'Learn the moves'], ['input', 'Paint your cube'], ['solve', 'Solve it'], ['practice', 'Practice']]

export default function App() {
  const [view, setView] = useState<View>('home')
  const [paint, setPaint] = useState<State>(() => { const p = load<unknown>('paint', BLANK); return isCube(p) ? p : BLANK })
  const [puzzle, setPuzzle] = useState<Puzzle | null>(restorePuzzle)
  const [visited, setVisited] = useState<Set<View>>(() => new Set(load<View[]>('visited', [])))
  const [repair, setRepair] = useState<number | null>(null) // solve position being checked against the real cube
  const [fix, setFix] = useState<Fix>()
  const [notice, setNotice] = useState<string>()
  const [session, setSession] = useState(0)
  const [theme, setTheme] = useState<Theme>(() => load<Theme>('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))
  useEffect(() => save('paint', paint), [paint])
  useEffect(() => save('start', puzzle?.start ?? null), [puzzle])
  useEffect(() => save('visited', [...visited]), [visited])
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
  useEffect(() => { window.scrollTo(0, 0) }, [view])

  const toggleTheme = (e: MouseEvent<HTMLButtonElement>) => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    const r = e.currentTarget.getBoundingClientRect()
    stickerWave(r.x + r.width / 2, r.y + r.height / 2, next === 'dark' ? '#121318' : '#eef0f4', () => {
      document.documentElement.dataset.theme = next
      flushSync(() => setTheme(next))
    })
  }

  const openSolve = (p: Puzzle, f?: Fix, n?: string) => go('solve', () => { setPuzzle(p); setFix(f); setNotice(n); setRepair(null); setSession(x => x + 1) })

  // Paint screen submit: a new cube, or the real cube checked against the solve in progress
  const submit = (actual: State) => {
    if (repair === null || !puzzle) return openSolve({ start: actual, plan: solve(actual) })
    const { states } = timeline(puzzle.start, puzzle.plan)
    const d = diagnose(states, repair, actual)
    if (d.kind === 'new') return openSolve({ start: actual, plan: solve(actual) }, undefined,
      "Your cube didn't match any point in the plan, so here's a fresh one from where your cube is now. Finished steps are skipped. Hold yellow on top and green facing you.")
    const hold = ` Hold your cube with yellow on top and ${colorName(states[d.at][22])} facing you.`
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
            {JOURNEY.map(([v, label], i) => (
              <li key={v} className={view === v ? 'on' : visited.has(v) ? 'seen' : ''}>
                <button aria-current={view === v ? 'step' : undefined} disabled={v === 'solve' && !puzzle} onClick={() => go(v, () => v === 'input' && setRepair(null))}>
                  <span className="num">{visited.has(v) && view !== v ? <Icon name="check" size={14} /> : i + 1}</span>
                  <span className="label">{label}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} key={theme} />
        </button>
      </header>
      <main className={'view-' + view}>
        {view === 'home' && <Home go={go} resume={!!puzzle} />}
        {view === 'learn' && <Learn go={go} />}
        {view === 'input' && (
          <Input paint={paint} setPaint={setPaint} blank={BLANK} onSubmit={submit}
            repair={repair !== null ? () => go('solve', () => setRepair(null)) : undefined} />
        )}
        {view === 'solve' && puzzle && (
          <Solve key={`${puzzle.start.join('')}-${session}`} puzzle={puzzle} fix={fix} notice={notice}
            again={() => go('input', () => { setPaint(BLANK); setRepair(null) })}
            practice={() => go('practice')}
            onMismatch={(expected, pos) => go('input', () => { setPaint(normalize(expected)); setRepair(pos) })} />
        )}
        {view === 'practice' && <Practice painted={paint.includes('_') || validate(paint) ? undefined : paint} />}
      </main>
    </>
  )
}
