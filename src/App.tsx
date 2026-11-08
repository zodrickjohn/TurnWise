import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { SOLVED, type State } from './cube/model.ts'
import { solve, validate, type Chunk } from './cube/solver.ts'
import { Icon, load, save } from './ui.tsx'
import Home from './views/Home.tsx'
import Learn from './views/Learn.tsx'
import Input from './views/Input.tsx'
import Solve from './views/Solve.tsx'

export type View = 'home' | 'learn' | 'input' | 'solve'
export type Puzzle = { start: State; plan: Chunk[][] }
const BLANK = SOLVED.map((c, i) => (i % 9 === 4 ? c : '_'))
const isCube = (s: unknown): s is State => Array.isArray(s) && s.length === 54 && s.every(c => typeof c === 'string' && 'wyrogb_'.includes(c))

// Rebuild a saved puzzle only if it is still a valid cube
function restorePuzzle(): Puzzle | null {
  const start = load<unknown>('start', null)
  try { return isCube(start) && !validate(start) ? { start, plan: solve(start) } : null } catch { return null }
}
const JOURNEY: [View, string][] = [['learn', 'Learn the moves'], ['input', 'Paint your cube'], ['solve', 'Solve it']]

export default function App() {
  const [view, setView] = useState<View>('home')
  const [paint, setPaint] = useState<State>(() => { const p = load<unknown>('paint', BLANK); return isCube(p) ? p : BLANK })
  const [puzzle, setPuzzle] = useState<Puzzle | null>(restorePuzzle)
  const [visited, setVisited] = useState<Set<View>>(() => new Set(load<View[]>('visited', [])))
  useEffect(() => save('paint', paint), [paint])
  useEffect(() => save('start', puzzle?.start ?? null), [puzzle])
  useEffect(() => save('visited', [...visited]), [visited])

  // Page changes cross-fade via the View Transitions API where supported
  const go = (v: View, then?: () => void) => {
    const swap = () => flushSync(() => { then?.(); setView(v); setVisited(s => new Set(s).add(view)) })
    document.startViewTransition ? document.startViewTransition(swap) : swap()
  }
  useEffect(() => { window.scrollTo(0, 0) }, [view])

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
                <button aria-current={view === v ? 'step' : undefined} disabled={v === 'solve' && !puzzle} onClick={() => go(v)}>
                  <span className="num">{visited.has(v) && view !== v ? <Icon name="check" size={14} /> : i + 1}</span>
                  <span className="label">{label}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </header>
      <main className={'view-' + view}>
        {view === 'home' && <Home go={go} resume={!!puzzle} />}
        {view === 'learn' && <Learn go={go} />}
        {view === 'input' && <Input paint={paint} setPaint={setPaint} blank={BLANK} onSolve={p => go('solve', () => setPuzzle(p))} />}
        {view === 'solve' && puzzle && <Solve key={puzzle.start.join('')} puzzle={puzzle} again={() => go('input', () => setPaint(BLANK))} />}
      </main>
    </>
  )
}
