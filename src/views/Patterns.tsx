import { useRef, useState } from 'react'
import type { Cube3D } from '../cube/Cube3D.ts'
import { SOLVED, invertMove, move, toMoves } from '../cube/model.ts'
import { CubeView, Icon, Mini, Tiles, describe, faceColor } from '../ui.tsx'
import type { View } from '../App.tsx'
import { Coach } from '../Coach.tsx'
import { PATTERNS } from '../cube/patterns.ts'

const reverse = (alg: string) => toMoves(alg).reverse().map(invertMove).join(' ')
const front = (alg: string) => move(SOLVED, alg).slice(18, 27).join('')

export default function Patterns({ go }: { go: (v: View) => void }) {
  const cube = useRef<Cube3D>(null)
  const [sel, setSel] = useState(0)
  const [pos, setPos] = useState(0) // moves of the pattern done so far
  const [back, setBack] = useState(false) // undoing it: the moves run in reverse
  const [playing, setPlaying] = useState(false)
  const run = useRef(0) // bumped when another pattern is picked: a playback in progress is dropped
  const stop = useRef(false) // pause: the turn in flight still counts
  const p = PATTERNS[sel], moves = toMoves(back ? reverse(p.alg) : p.alg)

  const choose = async (k: number) => { run.current++; setPlaying(false); setSel(k); setPos(0); setBack(false); await cube.current?.settle(); cube.current?.setState(SOLVED) } // a turn still animating finishes first
  // Play from here to the end; a second press pauses
  const play = async () => {
    if (playing) return void (stop.current = true)
    const id = run.current
    stop.current = false
    setPlaying(true)
    for (let k = pos; k < moves.length && !stop.current; k++) { await cube.current?.play(moves[k], 480); if (id !== run.current) return; setPos(k + 1) }
    setPlaying(false)
  }
  const step = async (dir: 1 | -1) => {
    if (playing || (dir === 1 ? pos >= moves.length : pos <= 0)) return
    await cube.current?.play(dir === 1 ? moves[pos] : invertMove(moves[pos - 1]), 480)
    setPos(pos + dir)
  }
  const undo = () => { setBack(true); setPos(0) }
  const done = pos >= moves.length, cur = moves[pos]

  return (
    <div className="split learn patterns">
      <article className="lesson">
        <header className="page-head">
          <h1>Make a pattern</h1>
          <p className="lede">Start from a solved cube and follow the moves. Each pattern is a short algorithm, and doing it backwards brings the cube home again.</p>
        </header>
        <div className="pattern-list" role="radiogroup" aria-label="Patterns">
          {PATTERNS.map((x, k) => (
            <button key={x.name} role="radio" aria-checked={k === sel} className="pattern" onClick={() => choose(k)}>
              <Mini pattern={front(x.alg)} label={`Front face of ${x.name}`} />
              <span><b>{x.name}</b><small>{toMoves(x.alg).length} moves</small></span>
            </button>
          ))}
        </div>
        <section className="panel">
          <h2>{p.name}{back && ', backwards'}</h2>
          <p>{back ? 'The same moves in reverse order, each turned the other way. This takes your cube back to solved.' : p.note}</p>
          <Tiles alg={moves.join(' ')} colors={moves.map(m => faceColor(SOLVED, m))} at={pos} done={pos} />
        </section>
        <section className="panel next-panel">
          <h2>Patterns are algorithms too.</h2>
          <p>Reading these moves is the same skill you use to solve. Got a scrambled cube? Paint it in and Turnwise solves it with you.</p>
          <button className="btn yellow" onClick={() => go('input')}>Paint my cube <Icon name="arrow" size={18} /></button>
        </section>
      </article>

      <aside className="stage">
        <div className="stage-card">
          <Coach className="stage-coach" mood={done ? 'cheer' : playing ? 'happy' : 'idle'} sayKey={`${sel}-${back}-${pos}`}
            say={done ? (back ? 'Back to solved. Pick another pattern!' : <>That's {p.name}! Undo it when you're ready.</>)
              : pos === 0 && !back ? 'Start with a solved cube, yellow on top and green facing you.'
              : <span className="say-move"><Tiles alg={cur} colors={[faceColor(SOLVED, cur)]} at={0} size="lg" />{describe(cur)}</span>} />
          <CubeView cubeRef={cube} initial={SOLVED} />
          <div className="transport">
            <button className="btn white icon" onClick={() => step(-1)} disabled={pos === 0 || playing} aria-label="Previous move"><Icon name="prev" /></button>
            {done && !back
              ? <button className="btn yellow play" onClick={undo}><Icon name="undo" /> Undo it</button>
              : done ? <button className="btn yellow play" onClick={() => choose((sel + 1) % PATTERNS.length)}>Next pattern <Icon name="arrow" size={18} /></button>
              : <button className="btn yellow play" onClick={play}><Icon name={playing ? 'pause' : 'play'} /> <span className="play-text">{playing ? 'Pause' : pos ? 'Keep going' : 'Play it'}</span></button>}
            <button className="btn white icon" onClick={() => step(1)} disabled={done || playing} aria-label="Next move"><Icon name="next" /></button>
          </div>
        </div>
      </aside>
    </div>
  )
}
