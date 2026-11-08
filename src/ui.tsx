import { useEffect, useRef, type CSSProperties, type RefObject } from 'react'
import Lenis from 'lenis'
import { Cube3D } from './cube/Cube3D.ts'
import { FACES, NAME, SOLVED, toMoves, type Face, type Size, type State } from './cube/model.ts'
import { SOLVED2, STAGES, STAGES2 } from './cube/solver.ts'
import { STAGES_BIG } from './cube/bigsolve.ts'
import { bigCube } from './cube/big.ts'

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
// Wheel scrolling glides with a little inertia (touch stays native); off for people who prefer less motion
export const lenis = reduceMotion ? null : new Lenis({ autoRaf: true, lerp: 0.085 })
// Jump to the top at once, cancelling any glide still in flight
export const toTop = () => (lenis ? lenis.scrollTo(0, { immediate: true, force: true }) : scrollTo(0, 0))

// Scroll reveals: only .reveal elements starting below the fold hide (.pre), then animate in (.in); returns a cleanup
export function revealOnScroll() {
  if (reduceMotion) return
  let pending = [...document.querySelectorAll('.reveal')].filter(el => el.getBoundingClientRect().top > innerHeight)
  pending.forEach(el => el.classList.add('pre'))
  // Anything that has reached the lower part of the screen, or been scrolled (or jumped) past, comes in
  const check = () => {
    pending = pending.filter(el => {
      if (el.getBoundingClientRect().top > innerHeight * 0.88) return true
      el.classList.replace('pre', 'in')
      return false
    })
    if (!pending.length) removeEventListener('scroll', check)
  }
  addEventListener('scroll', check, { passive: true })
  return () => removeEventListener('scroll', check)
}

// Per-browser memory (progress survives a refresh); storage can be blocked, so failures fall back silently
export function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem('turnwise.' + key); return v === null ? fallback : JSON.parse(v) } catch { return fallback }
}
export function save(key: string, value: unknown) {
  try { localStorage.setItem('turnwise.' + key, JSON.stringify(value)) } catch { /* storage unavailable */ }
}

// Mounts a Cube3D into a div and exposes it through cubeRef
export function CubeView({ cubeRef, initial, className = '', interactive = true, follow = false, size = 3 }: { cubeRef: RefObject<Cube3D | null>; initial: State; className?: string; interactive?: boolean; follow?: boolean; size?: Size }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const c = new Cube3D(host.current!, initial, interactive, follow && !reduceMotion, size)
    cubeRef.current = c
    return () => { c.dispose(); cubeRef.current = null }
  }, [])
  return <div ref={host} className={'cube ' + className} aria-label="3D cube, drag to look around" role="img" />
}

const FACE_NAME: Record<string, string> = { U: 'Top', D: 'Bottom', R: 'Right', L: 'Left', F: 'Front', B: 'Back' }
const HINT: Record<string, [string, string]> = {
  U: ['front row slides left', 'front row slides right'],
  D: ['front row slides right', 'front row slides left'],
  R: ['front column goes up', 'front column goes down'],
  L: ['front column goes down', 'front column goes up'],
  F: ['top row slides right', 'top row slides left'],
  B: ['top row slides left', 'top row slides right'],
  y: ['the right side comes to the front', 'the left side comes to the front'],
  x: ['the front goes to the top', 'the top comes to the front'],
  z: ['the top goes to the right', 'the top goes to the left'],
}
const MIDDLE: Record<string, string> = { M: 'Middle slice between left and right, turned like the left face', E: 'Middle slice between top and bottom, turned like the bottom face', S: 'Middle slice between front and back, turned like the front face' }

// Plain-English description of one move
// Big cubes add r (the second layer in, alone), Rw (the face and that layer together), M E S and x z
export function describe(m: string) {
  const k = m.endsWith('2') ? 2 : m.endsWith("'") ? 1 : 0, core = m.replace(/['2]$/, '')
  if ('xyz'.includes(core)) return k === 2 ? (core === 'x' ? 'Turn the whole cube upside down' : 'Turn the whole cube half way around') : `Turn the whole cube so ${HINT[core][k]}`
  if (MIDDLE[core]) return `${MIDDLE[core]}${k === 2 ? ', half turn' : k ? ', backwards' : ''}`
  const f = core.match(/[URFDLB]/i)![0], F = f.toUpperCase()
  const what = core.endsWith('w') ? `${FACE_NAME[F]} face and the layer behind it` : f !== F ? `${FACE_NAME[F]} inner slice (the second layer in)` : `${FACE_NAME[F]} face`
  return k === 2 ? `${what}, half turn` : `${what} ${k ? 'counter-clockwise' : 'clockwise'}: ${HINT[F][k]}`
}

// Color of the center on the face a move turns (what the user sees on that side right now)
export const faceColor = (s: State, m: string) => {
  const f = m.match(/[URFDLB]/i)?.[0]
  if (!f || /^[xyzMES]/.test(m)) return 'rot' // whole-cube turns and middle slices
  const n = Math.round(Math.sqrt(s.length / 6)), mid = (n - 1) >> 1
  return s[FACES.indexOf(f.toUpperCase() as Face) * n * n + mid * n + mid]
}

// Move notation as sticker key caps colored by the face they turn; `at` highlights one, `done` dims earlier ones
export function Tiles({ alg, colors, at = -1, done = -1, size = '' }: { alg: string; colors?: string[]; at?: number; done?: number; size?: string }) {
  return (
    <span className="tiles">
      {toMoves(alg).map((m, i) => (
        <kbd key={i} className={`tile ${size} t-${m[0] === 'y' ? 'rot' : colors?.[i] ?? 'ink'}${i === at ? ' now' : i < done ? ' past' : ''}`} title={describe(m)}>{m}</kbd>
      ))}
    </span>
  )
}

// Tiny 3x3 face diagram: color letters, '_' = any/unsolved, '?' = right place but maybe twisted
export function Mini({ pattern, label }: { pattern: string; label: string }) {
  return (
    <span className="mini" role="img" aria-label={label} style={{ '--n': Math.sqrt(pattern.length) } as CSSProperties}>
      {[...pattern].map((c, i) => <i key={i} className={c === '?' ? 'q' : 'c-' + c} style={{ '--k': i } as CSSProperties} />)}
    </span>
  )
}

// Target pattern of each of the 8 steps, plus which phase it belongs to
export const STEP_ART: { pattern: string; view: string }[] = [
  { pattern: '_w_wyw_w_', view: 'Top' },
  { pattern: '_w_www_w_', view: 'Bottom' },
  { pattern: 'wwwwwwwww', view: 'Bottom' },
  { pattern: '___gggggg', view: 'Front' },
  { pattern: '_y_yyy_y_', view: 'Top' },
  { pattern: '_g_gggggg', view: 'Front' },
  { pattern: '?y?yyy?y?', view: 'Top' },
  { pattern: 'yyyyyyyyy', view: 'Top' },
]
export const PHASES = [
  { name: 'First layer', steps: [0, 1, 2], tone: 'w' },
  { name: 'Middle layer', steps: [3], tone: 'g' },
  { name: 'Last layer', steps: [4, 5, 6, 7], tone: 'y' },
]
// Faces in input order, their names, and how to hold the cube to see each one
export const ORDER: Face[] = ['F', 'R', 'B', 'L', 'U', 'D']
export const LABEL: Record<Face, string> = { U: 'Top', R: 'Right', F: 'Front', D: 'Bottom', L: 'Left', B: 'Back' }
export const HOLD: Record<Face, string> = {
  F: 'Yellow on top, green facing you.',
  R: 'Yellow on top, orange facing you. Green is now on your left.',
  B: 'Yellow on top, blue facing you.',
  L: 'Yellow on top, red facing you. Green is now on your right.',
  U: 'Tip the cube toward you so yellow faces you. Green ends up along the bottom edge.',
  D: 'Tip the cube away so white faces you. Green ends up along the top edge.',
}

// No centers on a 2x2: the learner picks a grip and keeps it
export const HOLD2: Record<Face, string> = {
  F: 'Pick a side to face you and a side to be on top. Keep that grip for every face.',
  R: 'Turn the whole cube a quarter to the left, so the right side faces you.',
  B: 'Another quarter turn to the left: the back faces you.',
  L: 'One more quarter turn: the left side faces you.',
  U: 'Back to your starting grip, then tip the cube toward you so the top faces you.',
  D: 'From your starting grip, tip the cube away so the bottom faces you.',
}
// Everything a view needs for one cube size: the steps, their phases and target art, how to hold it, and its solved state
type Phase = { name: string; steps: number[]; tone: string }
export type Kit = { size: Size; stages: typeof STAGES; phases: Phase[]; art: { pattern: string; view: string }[]; hold: Record<Face, string>; solved: State; stickers: number }
// Target art for the reduction steps, drawn on an N×N face, then the 3×3 steps
const bigArt = (N: number) => {
  const face = (fill: (r: number, c: number) => string) => Array.from({ length: N * N }, (_, i) => fill((i / N) | 0, i % N)).join('')
  const inner = (r: number, c: number) => r > 0 && r < N - 1 && c > 0 && c < N - 1
  const center = (col: string) => face((r, c) => (inner(r, c) ? col : '_'))
  return [
    { pattern: center('w'), view: 'Bottom' }, { pattern: center('y'), view: 'Top' }, { pattern: center('g'), view: 'Front' },
    { pattern: face((r, c) => (inner(r, c) || (r === 0 && c > 0 && c < N - 1) ? 'g' : '_')), view: 'Front' },
    ...STEP_ART,
  ]
}
const bigKit = (N: 4 | 5): Kit => ({
  size: N, stages: STAGES_BIG, solved: bigCube(N).SOLVED, stickers: N === 4 ? 96 : 144, hold: N === 4 ? HOLD2 : HOLD, art: bigArt(N),
  phases: [{ name: 'Centers', steps: [0, 1, 2], tone: 'w' }, { name: 'Edges', steps: [3], tone: 'g' }, { name: 'Solve it like a 3×3', steps: [4, 5, 6, 7, 8, 9, 10, 11], tone: 'y' }],
})
export const KIT: Record<Size, Kit> = {
  3: { size: 3, stages: STAGES, phases: PHASES, art: STEP_ART, hold: HOLD, solved: SOLVED, stickers: 48 },
  2: {
    size: 2, stages: STAGES2, solved: SOLVED2, stickers: 24, hold: HOLD2,
    phases: [{ name: 'First layer', steps: [0], tone: 'w' }, { name: 'Last layer', steps: [1, 2], tone: 'y' }],
    art: [{ pattern: 'wwww', view: 'Bottom' }, { pattern: '????', view: 'Top' }, { pattern: 'yyyy', view: 'Top' }],
  },
  4: bigKit(4),
  5: bigKit(5),
}
export const phaseOf = (step: number, phases = PHASES) => phases.findIndex(p => p.steps.includes(step))
export const colorName = (c: string) => NAME[c] ?? 'blank'

const ICONS: Record<string, string> = {
  play: 'M7 4.5v15l12.5-7.5z',
  pause: 'M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z',
  next: 'M5 4.5v15l10-7.5zM16.5 4.5h3v15h-3z',
  prev: 'M19 4.5v15L9 12zM4.5 4.5h3v15h-3z',
  check: 'M4.5 12.5l4.5 4.5L19.5 6.5',
  arrow: 'M4 12h15M13 6l6 6-6 6',
  reset: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4',
  close: 'M6 6l12 12M18 6L6 18',
  camera: 'M4 8h3l1.5-2.5h7L17 8h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  sun: 'M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5L20 20',
}
export function Icon({ name, size = 22, className }: { name: keyof typeof ICONS | string; size?: number; className?: string }) {
  const stroke = ['check', 'arrow', 'reset', 'close', 'camera', 'sun', 'moon', 'undo', 'bulb', 'search'].includes(name)
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={stroke ? 'none' : 'currentColor'} stroke={stroke ? 'currentColor' : 'none'} strokeWidth={stroke ? 2.6 : 0} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  )
}

const PAD_ROWS: [string, string][] = [['R', 'Right'], ['L', 'Left'], ['U', 'Top'], ['D', 'Bottom'], ['F', 'Front'], ['B', 'Back'], ['y', 'Whole cube']]

// Move keys colored by the face they turn; keyboard works too (letter = clockwise, Shift+letter = counter-clockwise)
export function MovePad({ state, now, onMove }: { state: State; now?: string; onMove: (m: string) => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1 || document.querySelector('dialog[open]')) return
      const f = e.key.toLowerCase() === 'y' ? 'y' : e.key.toUpperCase()
      if ('RLUDFBy'.includes(f)) onMove(f + (e.shiftKey ? "'" : ''))
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  })
  return (
    <div className="pad" role="group" aria-label="Move keys">
      {PAD_ROWS.map(([f, label]) => (
        <div key={f} className="pad-row">
          <span className="pad-label">{label}</span>
          {[f, f + "'", f + '2'].map(m => (
            <button key={m} className={`tile key-btn t-${faceColor(state, m)}${now === m ? ' now' : ''}`} onClick={() => onMove(m)} aria-label={describe(m)}>{m}</button>
          ))}
        </div>
      ))}
    </div>
  )
}

const CONFETTI = Array.from({ length: 36 }, (_, i) => ({ c: 'wyrogb'[i % 6], x: (i * 37) % 100, d: (i % 9) * 0.08, r: (i * 53) % 360 }))
export function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {CONFETTI.map((p, i) => <i key={i} className={'c-' + p.c} style={{ left: p.x + '%', animationDelay: p.d + 's', rotate: p.r + 'deg' }} />)}
    </div>
  )
}
