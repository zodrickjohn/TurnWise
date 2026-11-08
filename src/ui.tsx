import { useEffect, useRef, type RefObject } from 'react'
import { Cube3D } from './cube/Cube3D.ts'
import { FACES, NAME, toMoves, type Face, type State } from './cube/model.ts'

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
  close: 'M6 6l12 12M18 6L6 18',
  camera: 'M4 8h3l1.5-2.5h7L17 8h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  sun: 'M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5L20 20',
}
export function Icon({ name, size = 22 }: { name: keyof typeof ICONS | string; size?: number }) {
  const stroke = ['check', 'arrow', 'reset', 'close', 'camera', 'sun', 'moon', 'undo', 'bulb', 'search'].includes(name)
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={stroke ? 'none' : 'currentColor'} stroke={stroke ? 'currentColor' : 'none'} strokeWidth={stroke ? 2.6 : 0} strokeLinecap="round" strokeLinejoin="round">
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

// Theme switch: the screen breaks into cube stickers that flip in as a scrambled mosaic from (x, y),
// the theme swaps underneath, then the stickers fall away revealing it
export function stickerWave(x: number, y: number, bg: string, swap: () => void) {
  if (reduceMotion || !document.body.animate) return swap()
  const size = Math.max(64, Math.min(innerWidth, innerHeight) / 9)
  const cols = Math.ceil(innerWidth / size), rows = Math.ceil(innerHeight / size)
  const far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  const layer = document.createElement('div')
  layer.className = 'wave'
  layer.style.gridTemplateColumns = `repeat(${cols}, ${size}px)`
  const tiles = Array.from({ length: cols * rows }, (_, i) => {
    const t = layer.appendChild(document.createElement('i'))
    const d = Math.hypot((i % cols) * size + size / 2 - x, Math.floor(i / cols) * size + size / 2 - y) / far
    return { t, d, c: ['#ffd60a', '#f0302a', '#ff8a00', '#00c46a', '#2f6bff', '#ffffff'][(Math.random() * 6) | 0] }
  })
  document.body.appendChild(layer)
  const cover = tiles.map(({ t, d, c }) => t.animate(
    [{ transform: 'perspective(500px) rotateX(-95deg) scale(0.5)', background: c, opacity: 0 }, { transform: 'perspective(500px) rotateX(0) scale(1)', background: c, opacity: 1, offset: 0.4 },
      { transform: 'none', background: c, offset: 0.7 }, { transform: 'none', background: bg, opacity: 1 }],
    { duration: 760, delay: d * 460, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' }).finished)
  Promise.all(cover).then(() => {
    swap()
    const out = tiles.map(({ t, d }) => t.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(0.2) rotate(35deg)', opacity: 0 }], { duration: 360, delay: d * 300, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'both' }).finished)
    Promise.all(out).then(() => layer.remove())
  })
}
