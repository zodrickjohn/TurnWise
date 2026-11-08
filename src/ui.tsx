import { useEffect, useRef, type RefObject } from 'react'
import { Cube3D } from './cube/Cube3D.ts'
import { FACES, NAME, toMoves, type State } from './cube/model.ts'

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

// Per-browser memory (progress survives a refresh); storage can be blocked, so failures fall back silently
export function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem('turnwise.' + key); return v === null ? fallback : JSON.parse(v) } catch { return fallback }
}
export function save(key: string, value: unknown) {
  try { localStorage.setItem('turnwise.' + key, JSON.stringify(value)) } catch { /* storage unavailable */ }
}

// Mounts a Cube3D into a div and exposes it through cubeRef
export function CubeView({ cubeRef, initial, className = '', interactive = true, follow = false }: { cubeRef: RefObject<Cube3D | null>; initial: State; className?: string; interactive?: boolean; follow?: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const c = new Cube3D(host.current!, initial, interactive, follow && !reduceMotion)
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
}

// Plain-English description of one move
export function describe(m: string) {
  const f = m[0], k = m.endsWith('2') ? 2 : m.endsWith("'") ? 1 : 0
  if (f === 'y') return k === 2 ? 'Turn the whole cube half way around' : `Turn the whole cube so ${HINT.y[k]}`
  return k === 2 ? `${FACE_NAME[f]} face, half turn` : `${FACE_NAME[f]} face ${k ? 'counter-clockwise' : 'clockwise'}: ${HINT[f][k]}`
}

// Color of the center on the face a move turns (what the user sees on that side right now)
export const faceColor = (s: State, m: string) => (m[0] === 'y' ? 'rot' : s[FACES.indexOf(m[0] as never) * 9 + 4])

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
    <span className="mini" role="img" aria-label={label}>
      {[...pattern].map((c, i) => <i key={i} className={c === '?' ? 'q' : 'c-' + c} />)}
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
export const phaseOf = (step: number) => PHASES.findIndex(p => p.steps.includes(step))
export const colorName = (c: string) => NAME[c] ?? 'blank'

const ICONS: Record<string, string> = {
  play: 'M7 4.5v15l12.5-7.5z',
  pause: 'M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z',
  next: 'M5 4.5v15l10-7.5zM16.5 4.5h3v15h-3z',
  prev: 'M19 4.5v15L9 12zM4.5 4.5h3v15h-3z',
  check: 'M4.5 12.5l4.5 4.5L19.5 6.5',
  arrow: 'M4 12h15M13 6l6 6-6 6',
  reset: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4',
}
export function Icon({ name, size = 22 }: { name: keyof typeof ICONS | string; size?: number }) {
  const stroke = ['check', 'arrow', 'reset'].includes(name)
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={stroke ? 'none' : 'currentColor'} stroke={stroke ? 'currentColor' : 'none'} strokeWidth={stroke ? 2.6 : 0} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  )
}
