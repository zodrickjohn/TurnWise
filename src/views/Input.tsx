import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { Cube3D } from '../cube/Cube3D.ts'
import { FACES, SOLVED, cornersOnly, move, scramble, type Face, type Size, type State } from '../cube/model.ts'
import { bigCube, bigScramble } from '../cube/big.ts'
import { validateAny } from '../cube/bigsolve.ts'
import { CubeView, Icon, KIT, LABEL, LEVEL_MOVES, LEVEL_NAME, LEVEL_NOTE, Mini, ORDER, colorName } from '../ui.tsx'
import { LEVELS, type Level } from '../cube/methods.ts'
import Scanner from './Scanner.tsx'
import { Coach } from '../Coach.tsx'

const PALETTE = ['w', 'y', 'r', 'o', 'g', 'b']

// repair: set while checking the real cube against a solve in progress; it returns to the solve
// setSize: switch between 3x3 and 2x2 (left out while repairing, the size is the solve's)
type Props = { paint: State; setPaint: Dispatch<SetStateAction<State>>; blank: State; onSubmit: (s: State) => void | Promise<void>; repair?: () => void; size: Size; setSize?: (s: Size) => void; level: Level; setLevel?: (l: Level) => void }
export const faceOf = (s: State, f: Face, per = 9) => s.slice(FACES.indexOf(f) * per, FACES.indexOf(f) * per + per)
const range = (n: number) => Array.from({ length: n }, (_, i) => i)
const CELLS: Record<Size, number[]> = { 2: [0, 2, 6, 8], 3: range(9), 4: range(16), 5: range(25) } // positions on a face that a cube of this size has (a 2×2 lives in the 3×3 layout)

export default function Input({ paint, setPaint, blank, onSubmit, repair, size, setSize, level, setLevel }: Props) {
  const K = KIT[size], cells = CELLS[size], total = K.stickers, { per, fixed } = K
  const ofFace = (f: Face) => cells.map(n => faceOf(paint, f, per)[n])
  const [planning, setPlanning] = useState(false)
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

  const base = FACES.indexOf(face) * per
  const paintAt = (i: number) => { setPaint(p => (p[i] === color ? p : p.map((c, j) => (j === i ? color : c)))); setError('') }
  const fillRest = () => setPaint(p => p.map((c, j) => (j >= base && j < base + per && cells.includes(j - base) && c === '_' ? color : c)))
  const submit = () => {
    const problem = validateAny(paint, size)
    if (problem) return setError(problem)
    setPlanning(true) // big cubes plan in the background for a second or two
    Promise.resolve().then(() => onSubmit(paint)).catch(e => setError((e as Error).message)).finally(() => setPlanning(false))
  }

  const painted = paint.filter((c, i) => c !== '_' && i % per !== fixed).length
  const doneFaces = ORDER.filter(f => !ofFace(f).includes('_'))
  const doneCount = useRef(doneFaces.length)
  useEffect(() => {
    if (doneFaces.length > doneCount.current) setJustDone(doneFaces.find(f => f === face) ?? doneFaces.at(-1)!)
    doneCount.current = doneFaces.length
  }, [doneFaces.length])
  useEffect(() => { if (!justDone) return; const t = setTimeout(() => setJustDone(null), 2600); return () => clearTimeout(t) }, [justDone])
  const k = ORDER.indexOf(face)
  const faceDone = !ofFace(face).includes('_')
  const blanksHere = ofFace(face).filter(c => c === '_').length

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
            <p className="lede">{fixed >= 0
              ? 'Go face by face. Pick a color, then tap or drag across the stickers that match your cube. Centers are already set.'
              : `A ${size}×${size} has no fixed centers, so pick a grip and keep it. Then go face by face: pick a color and tap or drag across the matching stickers.`}</p>
          </header>
        )}
        {setSize && (
          <div className="mode-switch" role="radiogroup" aria-label="Cube size">
            {([2, 3, 4, 5] as const).map(n => <button key={n} role="radio" aria-checked={size === n} onClick={() => { setSize(n); setFace('F'); setError('') }}>{n}×{n}</button>)}
          </div>
        )}
        {setLevel && (
          <div className="method">
            <div className="mode-switch" role="radiogroup" aria-label="Method">
              {LEVELS.map(l => <button key={l} role="radio" aria-checked={level === l} onClick={() => setLevel(l)}>{LEVEL_NAME[l]}</button>)}
            </div>
            <p className="method-note">{LEVEL_NOTE[level]} About {LEVEL_MOVES[size][level]} moves on a {size}×{size}.</p>
          </div>
        )}

        <div className="scan-callout">
          <p><b>Faster:</b> show each face to your camera and Turnwise reads the colors for you.</p>
          <button className="btn ink" onClick={() => setScanning(true)}><Icon name="camera" size={20} /> Scan with camera</button>
        </div>
        {scanning && (
          <Scanner
            start={face}
            size={size}
            onClose={() => setScanning(false)}
            onFaces={(faces, next) => {
              setPaint(p => p.map((c, i) => (i % per === fixed ? c : faces[FACES[(i / per) | 0]]?.[i % per] ?? c)))
              setFace(next)
              setError('')
            }}
          />
        )}

        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={painted} aria-label="Stickers painted">
          <span style={{ transform: `scaleX(${painted / total})` }} />
          <b>{painted} of {total} stickers</b>
        </div>

        <ol className="face-tabs" aria-label="Faces">
          {ORDER.map(f => {
            const done = !ofFace(f).includes('_')
            return (
              <li key={f}>
                <button className={(f === face ? 'on ' : '') + (done ? 'done' : '')} aria-current={f === face ? 'step' : undefined} onClick={() => setFace(f)}>
                  <Mini pattern={ofFace(f).join('')} label={`${LABEL[f]} face`} />
                  <span>{LABEL[f]}</span>
                  {done && <span className="tick"><Icon name="check" size={14} /></span>}
                </button>
              </li>
            )
          })}
        </ol>

        <section className="panel editor" aria-label={`${LABEL[face]} face`}>
          <div className="editor-head">
            <h2>{fixed >= 0 && <span className={'dot c-' + paint[base + fixed]} />}{LABEL[face]} face</h2>
            <p>{K.hold[face]}</p>
          </div>
          <div className={'big-face n' + size} key={face + size} onPointerLeave={() => (dragging.current = false)}>
            {cells.map(n => {
              const i = base + n, c = paint[i]
              return n === fixed ? (
                <span key={n} className={'big-st center c-' + c} title={`Center: ${colorName(c)}`}><span>center</span></span>
              ) : (
                <button
                  key={n}
                  className={'big-st c-' + c}
                  aria-label={`Sticker ${cells.indexOf(n) + 1}: ${colorName(c)}. Paint ${colorName(color)}`}
                  onPointerDown={e => { e.preventDefault(); (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); dragging.current = true; paintAt(i) }}
                  onPointerEnter={() => dragging.current && paintAt(i)}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), paintAt(i))}
                />
              )
            })}
          </div>
          <div className={"palette" + (size > 3 ? " big" : "")} role="radiogroup" aria-label="Paint color">
            {PALETTE.map((c, n) => (
              <button key={c} role="radio" aria-checked={color === c} className={'swatch c-' + c} onClick={() => setColor(c)} title={`${colorName(c)} (key ${n + 1})`}>
                <span className="count">{paint.filter(x => x === c).length}/{size * size}</span>
                <span className="sr-only">{colorName(c)}</span>
              </button>
            ))}
          </div>
          <div className="editor-foot">
            <button className="btn white" disabled={k === 0} onClick={() => setFace(ORDER[k - 1])}>Previous face</button>
            {blanksHere > 0 && blanksHere < cells.length - (fixed >= 0 ? 1 : 0) && <button className="btn ghost" onClick={fillRest}>Fill {blanksHere} blank{blanksHere > 1 ? 's' : ''} with {colorName(color)}</button>}
            {k < 5 ? (
              <button className={'btn yellow' + (faceDone ? ' nudge' : '')} onClick={() => setFace(ORDER[k + 1])}>Next: {LABEL[ORDER[k + 1]]} <Icon name="arrow" size={18} /></button>
            ) : (
              <button className={'btn yellow' + (painted === total ? ' nudge' : '')} onClick={submit} disabled={planning}>{planning ? 'Planning your solve…' : repair ? 'Check my cube' : 'Solve my cube'} <Icon name="arrow" size={18} /></button>
            )}
          </div>
        </section>
      </article>

      <aside className="stage">
        <div className="stage-card">
          <CubeView key={size} cubeRef={cube} initial={paint} size={size} />
          <div className="stage-actions">
            <Coach className="paint-coach" size={76}
              mood={error ? 'oops' : painted === total ? 'cheer' : justDone ? 'cheer' : 'idle'}
              sayKey={error || (painted === total ? 'all' : justDone ? `done-${justDone}-${doneFaces.length}` : 'idle')}
              say={error ? <span role="alert">{error}</span>
                : painted === total ? (repair ? "All in! Hit Check and I'll find the slip." : `All ${total} stickers in! Hit Solve when ready.`)
                : justDone ? `${LABEL[justDone]} face done! ${total - painted} to go.`
                : `${total - painted} stickers to go. Tip: keys 1 to 6 switch colors.`} />
            <button className="btn yellow wide" onClick={submit} disabled={planning}>{planning ? 'Planning your solve…' : repair ? 'Check my cube' : painted < total ? `Solve my cube (${total - painted} to go)` : 'Solve my cube'}</button>
            {!repair && <div className="row">
              <button className="btn white" onClick={() => { const s = size > 3 ? bigCube(size).move(bigCube(size).SOLVED, bigScramble()) : move(SOLVED, scramble()); setPaint(size === 2 ? cornersOnly(s) : s); setError('') }}>Use a random cube</button>
              <button className="btn ghost" onClick={() => { setPaint(blank); setError(''); setFace('F') }}>Clear all</button>
            </div>}
          </div>
        </div>
      </aside>
    </div>
  )
}
