import { useRef, useState } from 'react'
import type { Cube3D } from '../cube/Cube3D.ts'
import { SOLVED, toMoves } from '../cube/model.ts'
import { CubeView, Icon, MovePad, Tiles, describe, faceColor } from '../ui.tsx'
import type { View } from '../App.tsx'

const QUIZ = ['R', "R'", 'L', "L'", 'U', "U'", 'D', "D'", 'F', "F'", 'R2', 'U2']
const TRIGGER = "R U R' U'"
type Quiz = { answer: string; result?: 'yes' | 'no'; guess?: string; streak: number }

export default function Learn({ go }: { go: (v: View) => void }) {
  const cube = useRef<Cube3D>(null)
  const [state, setState] = useState(SOLVED)
  const [now, setNow] = useState('')
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const busy = useRef(false)

  const play = async (alg: string, ms = 560, reveal = true) => {
    if (busy.current || !cube.current) return
    busy.current = true
    for (const m of toMoves(alg)) {
      if (reveal) setNow(m)
      await cube.current.play(m, ms)
      setState(cube.current.state)
    }
    busy.current = false
  }

  // Quiz: the cube makes a move, the learner names it on the pad
  const ask = async (streak = quiz?.streak ?? 0) => {
    const answer = QUIZ.filter(m => m !== quiz?.answer)[(Math.random() * (QUIZ.length - 1)) | 0]
    setQuiz({ answer, streak })
    setNow('')
    await play(answer, 900, false)
    setNow('?')
  }
  const press = (m: string) => {
    if (!quiz || quiz.result) return play(m)
    if (busy.current) return
    const right = m === quiz.answer
    setQuiz({ ...quiz, guess: m, result: right ? 'yes' : 'no', streak: right ? quiz.streak + 1 : 0 })
    setNow(quiz.answer)
  }

  return (
    <div className="split learn">
      <article className="lesson">
        <header className="page-head">
          <h1>Learn the moves</h1>
          <p className="lede">Five minutes here makes every later step easier. Keep your cube in your hands and copy each move.</p>
        </header>

        <section className="panel">
          <h2>Hold it like this</h2>
          <div className="grip">
            <span className="grip-chip c-y">Yellow center on top</span>
            <span className="grip-chip c-g">Green center facing you</span>
          </div>
          <p>Centers never move relative to each other, so they're your map: every piece belongs next to the centers that share its colors. Keep this grip unless a step says to turn the whole cube.</p>
        </section>

        <section className="panel">
          <h2>Reading a move</h2>
          <dl className="read">
            <div><dt><Tiles alg="R" colors={['o']} size="lg" /></dt><dd>A letter alone: turn that face <b>clockwise</b>, as if you were looking straight at it.</dd></div>
            <div><dt><Tiles alg="R'" colors={['o']} size="lg" /></dt><dd>With a dash, said "R prime": <b>counter-clockwise</b>.</dd></div>
            <div><dt><Tiles alg="R2" colors={['o']} size="lg" /></dt><dd>With a 2: a <b>half turn</b>. Direction doesn't matter.</dd></div>
            <div><dt><Tiles alg="y" size="lg" /></dt><dd>Lowercase y: turn the <b>whole cube</b> in your hands, like U, without twisting anything.</dd></div>
          </dl>
          <p className="note">Tile colors match the center on that face right now, so you always know which side to grab.</p>
        </section>

        <section className={'panel pad-panel' + (quiz ? ' quizzing' : '')}>
          <div className="pad-head">
            <h2>{quiz ? 'Name that move' : 'Try every move'}</h2>
            <button className="btn small" onClick={() => (quiz ? setQuiz(null) : ask(0))}>{quiz ? 'Back to free play' : 'Quiz me'}</button>
          </div>
          <p className="pad-help">
            {!quiz ? <>Tap a key or use your keyboard: <kbd className="key">R</kbd> turns right, <kbd className="key">Shift</kbd> + <kbd className="key">R</kbd> turns it back.</>
              : !quiz.result ? 'Watch the cube, then tap the move it just made.'
              : quiz.result === 'yes' ? <span className="ok">Yes, that was {quiz.answer}. {quiz.streak > 1 && `${quiz.streak} in a row!`}</span>
              : <span className="bad">Not quite: you picked {quiz.guess}, the cube did {quiz.answer}.</span>}
          </p>
          <MovePad state={state} now={now} onMove={press} />
          {quiz?.result && (
            <div className="actions">
              <button className="btn yellow" onClick={() => ask()}>Next move <Icon name="arrow" size={18} /></button>
              {quiz.result === 'no' && <button className="btn white" onClick={() => play(quiz.answer, 900)}>Watch it again</button>}
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Your first algorithm</h2>
          <p>An algorithm is a short recipe of moves. This one is called <b>the trigger</b>, and you'll use it a lot:</p>
          <Tiles alg={TRIGGER} colors={toMoves(TRIGGER).map(m => faceColor(state, m))} size="lg" />
          <p>Do it six times in a row and the cube comes back to exactly where it started. Try it on your own cube.</p>
          <div className="actions">
            <button className="btn white" onClick={() => play(TRIGGER)}><Icon name="play" size={18} /> Play the trigger</button>
            <button className="btn white" onClick={() => play(Array(6).fill(TRIGGER).join(' '), 260)}>Play it six times</button>
            <button className="btn ghost" onClick={() => { if (busy.current) return; cube.current?.setState(SOLVED); setState(SOLVED); setNow('') }}><Icon name="reset" size={18} /> Reset cube</button>
          </div>
        </section>

        <section className="panel next-panel">
          <h2>Got it? Copy your cube in.</h2>
          <p>Next you paint in the colors of your scrambled cube, one face at a time.</p>
          <button className="btn yellow" onClick={() => go('input')}>Paint my cube <Icon name="arrow" size={18} /></button>
        </section>
      </article>

      <aside className="stage">
        <div className="stage-card">
          <CubeView cubeRef={cube} initial={SOLVED} />
          <div className="say" aria-live="polite">
            {now && now !== '?' ? <><Tiles alg={now} colors={[faceColor(state, now)]} at={0} size="xl" /><p>{describe(now)}</p></>
              : now === '?' ? <p className="big-q">Which move was that?</p>
              : <p>Tap any move to see it on the cube.</p>}
          </div>
        </div>
      </aside>
    </div>
  )
}
