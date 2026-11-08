import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { Cube3D } from '../cube/Cube3D.ts'
import { FACES, SOLVED, move, scramble, type Face, type State } from '../cube/model.ts'
import { validate } from '../cube/solver.ts'
import { CubeView, HOLD, Icon, LABEL, Mini, ORDER, colorName } from '../ui.tsx'
import Scanner from './Scanner.tsx'
import { Coach } from '../Coach.tsx'

const PALETTE = ['w', 'y', 'r', 'o', 'g', 'b']

// repair: set while checking the real cube against a solve in progress; it returns to the solve
type Props = { paint: State; setPaint: Dispatch<SetStateAction<State>>; blank: State; onSubmit: (s: State) => void; repair?: () => void }
export const faceOf = (s: State, f: Face) => s.slice(FACES.indexOf(f) * 9, FACES.indexOf(f) * 9 + 9)

export default function Input({ paint, setPaint, blank, onSubmit, repair }: Props) {
  const cube = useRef<Cube3D>(null)
  const [color, setColor] = useState('w')
  const [face, setFace] = useState<Face>('F')
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)
  const dragging = useRef(false)
  const [justDone, setJustDone] = useState<Face | null>(null) // a face was just completed: Cubie cheers it

  useEffect(() => { cube.current?.setState(paint) }, [paint])
  useEffect(() => { cube.current?.focusFace(face) }, [face])
  useEffect(() => {
    const key = (e: KeyboardEvent) => { const c = PALETTE[Number(e.key) - 1]; if (c) setColor(c) }
    const up = () => (dragging.current = false)
    addEventListener('keydown', key)
    addEventListener('pointerup', up)
    return () => { removeEventListener('keydown', key); removeEventListener('pointerup', up) }
  }, [])

  const base = FACES.indexOf(face) * 9
  const paintAt = (i: number) => { setPaint(p => (p[i] === color ? p : p.map((c, j) => (j === i ? color : c)))); setError('') }
  const fillRest = () => setPaint(p => p.map((c, j) => (j >= base && j < base + 9 && c === '_' ? color : c)))
  const submit = () => {
    const problem = validate(paint)
    if (problem) return setError(problem)
    try { onSubmit(paint) } catch (e) { setError((e as Error).message) }
  }

  const painted = paint.filter((c, i) => c !== '_' && i % 9 !== 4).length
  const doneFaces = ORDER.filter(f => !faceOf(paint, f).includes('_'))
  const doneCount = useRef(doneFaces.length)
  useEffect(() => {
    if (doneFaces.length > doneCount.current) setJustDone(doneFaces.find(f => f === face) ?? doneFaces.at(-1)!)
    doneCount.current = doneFaces.length
  }, [doneFaces.length])
  useEffect(() => { if (!justDone) return; const t = setTimeout(() => setJustDone(null), 2600); return () => clearTimeout(t) }, [justDone])
  const k = ORDER.indexOf(face)
  const faceDone = !faceOf(paint, face).includes('_')
  const blanksHere = faceOf(paint, face).filter(c => c === '_').length

  return (
    <div className="split input">
      <article className="lesson">
        {repair ? (
          <header className="page-head repair-head">
            <span className="detective" aria-hidden="true"><Icon name="search" size={30} /></span>
            <h1>Let's find the slip</h1>
            <p className="lede">We've filled in what your cube <b>should</b> look like right now. Change any sticker that's different on your real cube, or scan it. Turnwise will work out what went wrong.</p>
            <button className="btn ghost" onClick={repair}>Back to the solve</button>
          </header>
        ) : (
          <header className="page-head">
            <h1>Paint your cube</h1>
            <p className="lede">Go face by face. Pick a color, then tap or drag across the stickers that match your cube. Centers are already set.</p>
          </header>
        )}

        <div className="scan-callout">
          <p><b>Faster:</b> show each face to your camera and Turnwise reads the colors for you.</p>
          <button className="btn ink" onClick={() => setScanning(true)}><Icon name="camera" size={20} /> Scan with camera</button>
        </div>
        {scanning && (
          <Scanner
            start={face}
            onClose={() => setScanning(false)}
            onFaces={(faces, next) => {
              setPaint(p => p.map((c, i) => faces[FACES[(i / 9) | 0]]?.[i % 9] ?? c))
              setFace(next)
              setError('')
            }}
          />
        )}

        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={48} aria-valuenow={painted} aria-label="Stickers painted">
          <span style={{ transform: `scaleX(${painted / 48})` }} />
          <b>{painted} of 48 stickers</b>
        </div>

        <ol className="face-tabs" aria-label="Faces">
          {ORDER.map(f => {
            const done = !faceOf(paint, f).includes('_')
            return (
              <li key={f}>
                <button className={(f === face ? 'on ' : '') + (done ? 'done' : '')} aria-current={f === face ? 'step' : undefined} onClick={() => setFace(f)}>
                  <Mini pattern={faceOf(paint, f).join('')} label={`${LABEL[f]} face`} />
                  <span>{LABEL[f]}</span>
                  {done && <span className="tick"><Icon name="check" size={14} /></span>}
                </button>
              </li>
            )
          })}
        </ol>

        <section className="panel editor" aria-label={`${LABEL[face]} face`}>
          <div className="editor-head">
            <h2><span className={'dot c-' + paint[base + 4]} />{LABEL[face]} face</h2>
            <p>{HOLD[face]}</p>
          </div>
          <div className="big-face" key={face} onPointerLeave={() => (dragging.current = false)}>
            {faceOf(paint, face).map((c, n) => {
              const i = base + n
              return n === 4 ? (
                <span key={n} className={'big-st center c-' + c} title={`Center: ${colorName(c)}`}><span>center</span></span>
              ) : (
                <button
                  key={n}
                  className={'big-st c-' + c}
                  aria-label={`Sticker ${n + 1}: ${colorName(c)}. Paint ${colorName(color)}`}
                  onPointerDown={e => { e.preventDefault(); (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); dragging.current = true; paintAt(i) }}
                  onPointerEnter={() => dragging.current && paintAt(i)}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), paintAt(i))}
                />
              )
            })}
          </div>
          <div className="palette" role="radiogroup" aria-label="Paint color">
            {PALETTE.map((c, n) => (
              <button key={c} role="radio" aria-checked={color === c} className={'swatch c-' + c} onClick={() => setColor(c)} title={`${colorName(c)} (key ${n + 1})`}>
                <span className="count">{paint.filter(x => x === c).length}/9</span>
                <span className="sr-only">{colorName(c)}</span>
              </button>
            ))}
          </div>
          <div className="editor-foot">
            <button className="btn white" disabled={k === 0} onClick={() => setFace(ORDER[k - 1])}>Previous face</button>
            {blanksHere > 0 && blanksHere < 8 && <button className="btn ghost" onClick={fillRest}>Fill {blanksHere} blank{blanksHere > 1 ? 's' : ''} with {colorName(color)}</button>}
            {k < 5 ? (
              <button className={'btn yellow' + (faceDone ? ' nudge' : '')} onClick={() => setFace(ORDER[k + 1])}>Next: {LABEL[ORDER[k + 1]]} <Icon name="arrow" size={18} /></button>
            ) : (
              <button className={'btn yellow' + (painted === 48 ? ' nudge' : '')} onClick={submit}>{repair ? 'Check my cube' : 'Solve my cube'} <Icon name="arrow" size={18} /></button>
            )}
          </div>
        </section>
      </article>

      <aside className="stage">
        <div className="stage-card">
          <CubeView cubeRef={cube} initial={paint} />
          <div className="stage-actions">
            <Coach className="paint-coach" size={76}
              mood={error ? 'oops' : painted === 48 ? 'cheer' : justDone ? 'cheer' : 'idle'}
              sayKey={error || (painted === 48 ? 'all' : justDone ? `done-${justDone}-${doneFaces.length}` : 'idle')}
              say={error ? <span role="alert">{error}</span>
                : painted === 48 ? (repair ? "All in! Hit Check and I'll find the slip." : 'All 48 stickers in! Hit Solve when ready.')
                : justDone ? `${LABEL[justDone]} face done! ${48 - painted} to go.`
                : `${48 - painted} stickers to go. Tip: keys 1 to 6 switch colors.`} />
            <button className="btn yellow wide" onClick={submit}>{repair ? 'Check my cube' : painted < 48 ? `Solve my cube (${48 - painted} to go)` : 'Solve my cube'}</button>
            {!repair && <div className="row">
              <button className="btn white" onClick={() => { setPaint(move(SOLVED, scramble())); setError('') }}>Use a random cube</button>
              <button className="btn ghost" onClick={() => { setPaint(blank); setError(''); setFace('F') }}>Clear all</button>
            </div>}
          </div>
        </div>
      </aside>
    </div>
  )
}
