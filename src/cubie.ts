// Cubie, the Turnwise mascot: an isometric cube with a face, sneakers and (for the hero) a cape.
// Shared by the theme show and the on-page coach, so both are the same character
export const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
export const SPRING = 'cubic-bezier(0.34, 1.4, 0.64, 1)' // character overshoot: squash and stretch settle past their mark
export const IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)'
export const FALL = 'cubic-bezier(0.5, 0, 0.75, 0)'
export const CAST = [
  ['#ffd60a', '#f0302a', '#00c46a', '#2f6bff', '#f6f6f2', '#ff8a00', '#00c46a', '#ffd60a', '#f0302a'],
  ['#2f6bff', '#2f6bff', '#f6f6f2', '#00c46a', '#2f6bff', '#ffd60a', '#2f6bff', '#f0302a', '#2f6bff'],
  ['#ff8a00', '#f0302a', '#ff8a00', '#ffd60a', '#ff8a00', '#ff8a00', '#00c46a', '#ff8a00', '#f6f6f2'],
]
export type Mood = 'smile' | 'grit' | 'o' | 'yawn'

export const node = (html: string) => {
  const t = document.createElement('template')
  t.innerHTML = html.trim()
  return t.content.firstElementChild as HTMLElement
}
export const anim = (e: Element, k: Keyframe[], o: KeyframeAnimationOptions) => e.animate(k, { fill: 'both', ...o })
export const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
export const pivot = (o: string) => `style="transform-box: fill-box; transform-origin: ${o}"`
export const show = (els: Element[], on: boolean, delay = 0, duration = 90) => els.forEach(e => anim(e, [{}, { opacity: on ? 1 : 0 }], { duration, delay }))

// Cubie's SVG plus speed lines; sized by its container
export function cubieMarkup(stickers: string[], cape = false) {
  const tops = [...stickers].reverse(), sides = [...stickers.slice(3), ...stickers.slice(0, 3)]
  return `<svg viewBox="-16 -6 100 100" width="100%" height="100%" aria-hidden="true">
    ${cape ? `<path class="cape" ${pivot('100% 0%')} d="M58 18 C30 22 -6 34 -14 78 L-2 72 L6 82 L14 70 C22 52 36 34 58 24 Z" fill="#f0302a" stroke="#000" stroke-width="2.6" stroke-linejoin="round"/>` : ''}
    ${[22, 42].map((lx, i) => `<g class="leg-${i ? 'r' : 'l'}" ${pivot('50% 0%')}>
      <path d="M${lx} 68 L${lx} 84" stroke="#000" stroke-width="7" stroke-linecap="round"/>
      <rect x="${lx - 7}" y="82" width="${16}" height="9" rx="4.5" fill="#f0302a" stroke="#000" stroke-width="2.4"/>
      <path d="M${lx - 3} 86 h8" stroke="#fff" stroke-width="2" stroke-linecap="round"/></g>`).join('')}
    <g class="body" ${pivot('50% 100%')}>
      <g class="arm-l" ${pivot('100% 0%')}><path d="M4 40 L-7 52" stroke="#000" stroke-width="6.5" stroke-linecap="round"/><circle cx="-8" cy="53" r="4.5" fill="#fff" stroke="#000" stroke-width="2.4"/></g>
      <polygon points="2,14 62,14 74,3 14,3" fill="#000" stroke="#000" stroke-width="3" stroke-linejoin="round"/>
      <g transform="matrix(1 0 1.09 -1 2 14)">${tops.map((c, i) => `<rect x="${3 + (i % 3) * 19}" y="${1 + ((i / 3) | 0) * 3.3}" width="15" height="2.5" rx="1" fill="${c}"/>`).join('')}</g>
      <polygon points="2,14 62,14 74,3 14,3" fill="#fff" opacity="0.22"/>
      <polygon points="62,14 74,3 74,61 62,72" fill="#000" stroke="#000" stroke-width="3" stroke-linejoin="round"/>
      <g transform="matrix(1.09 -1 0 1 62 14)">${sides.map((c, i) => `<rect x="${1.2 + (i % 3) * 3.4}" y="${4.5 + ((i / 3) | 0) * 18}" width="2.6" height="15" rx="1" fill="${c}"/>`).join('')}</g>
      <polygon points="62,14 74,3 74,61 62,72" fill="#000" opacity="0.32"/>
      <rect x="2" y="14" width="60" height="58" rx="10" fill="#000"/>
      ${stickers.map((c, i) => `<rect x="${7 + (i % 3) * 18}" y="${19 + ((i / 3) | 0) * 17.5}" width="15" height="14.5" rx="4" fill="${c}"/><rect x="${9 + (i % 3) * 18}" y="${21 + ((i / 3) | 0) * 17.5}" width="6" height="2.6" rx="1.3" fill="#fff" opacity="0.55"/>`).join('')}
      <g class="arm-r" ${pivot('0% 0%')}><path d="M70 40 L81 52" stroke="#000" stroke-width="6.5" stroke-linecap="round"/><circle cx="82" cy="53" r="4.5" fill="#fff" stroke="#000" stroke-width="2.4"/></g>
      ${[22, 42].map((ex, i) => `<g><circle cx="${ex}" cy="34" r="8.5" fill="#fff" stroke="#000" stroke-width="3"/>
        <g class="pupil"><circle cx="${ex}" cy="35" r="3.8" fill="#000"/><circle cx="${ex + 1.4}" cy="33.4" r="1.3" fill="#fff"/></g>
        <rect class="lid" x="${ex - 10}" y="24" width="20" height="11" fill="#000" ${pivot('50% 0%')}/>
        <path class="shut" d="M${ex - 6} 34 Q${ex} 40 ${ex + 6} 34" stroke="#000" stroke-width="3" fill="none" stroke-linecap="round" opacity="0"/>
        <path class="brow" ${pivot(i ? '0% 50%' : '100% 50%')} d="M${ex - 8} 22 L${ex + 8} 22" stroke="#000" stroke-width="4" stroke-linecap="round"/></g>`).join('')}
      <path class="m-smile" d="M25 54 Q32 61 39 54" stroke="#000" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <g class="m-grit" opacity="0"><rect x="23" y="51" width="18" height="9" rx="3" fill="#fff" stroke="#000" stroke-width="2.6"/><path d="M23 55.5 h18 M29 51 v9 M35 51 v9" stroke="#000" stroke-width="1.6"/></g>
      <g class="m-o" opacity="0"><ellipse cx="32" cy="56" rx="5" ry="6" fill="#000"/><ellipse cx="32" cy="59" rx="3" ry="2" fill="#f0302a"/></g>
      <ellipse class="m-yawn" cx="32" cy="56" rx="6" ry="8" fill="#000" opacity="0"/>
    </g>
  </svg>
  <div class="speed-lines">${'<i></i>'.repeat(5)}</div>`
}

// Controls for a rendered Cubie: eyes, mouths, brows and whole-body gestures
export function rig(el: Element, cape = false) {
  const q = (s: string) => el.querySelector(s) as SVGElement
  const qa = (s: string) => [...el.querySelectorAll(s)]
  const lids = qa('.lid'), pupils = qa('.pupil'), shut = qa('.shut'), brows = qa('.brow')
  const mouths: Record<Mood, Element> = { smile: q('.m-smile'), grit: q('.m-grit'), o: q('.m-o'), yawn: q('.m-yawn') }
  const look = (dx: number, dy: number, delay = 0, duration = 260) => pupils.forEach(p => anim(p, [{}, { transform: `translate(${dx}px,${dy}px)` }], { duration, delay, easing: EASE }))
  const eyes = (open: number, delay = 0, duration = 260) => lids.forEach(l => anim(l, [{}, { transform: `scaleY(${1 - open})` }], { duration, delay, easing: EASE }))
  const mood = (m: Mood, delay = 0) => (Object.keys(mouths) as Mood[]).forEach(k => show([mouths[k]], k === m, delay))
  const brow = (kind: 'angry' | 'up' | 'flat', delay = 0) => brows.forEach((b, i) => anim(b, [{}, { transform: kind === 'angry' ? `translateY(3px) rotate(${i ? -16 : 16}deg)` : kind === 'up' ? 'translateY(-4px)' : 'none' }], { duration: 160, delay, easing: EASE }))
  const sleep = (delay = 0) => { // lids droop, then the eyes become peaceful closed curves
    eyes(0.5, delay, 160)
    show([...lids, ...pupils], false, delay + 160)
    show(shut, true, delay + 160, 140)
    mood('smile', delay)
    brow('flat', delay)
  }
  const flutter = (delay: number, duration: number) => cape && anim(q('.cape'), [{ transform: 'rotate(-4deg) skewY(0deg)' }, { transform: 'rotate(5deg) skewY(-6deg)' }, { transform: 'rotate(-4deg) skewY(0deg)' }], { duration: 260, delay, iterations: Math.max(1, Math.round(duration / 260)), fill: 'none' })
  const lines = (delay: number, duration: number) => qa('.speed-lines i').forEach((l, i) => anim(l, [{ transform: 'scaleX(0)', opacity: 0 }, { transform: 'scaleX(1)', opacity: 0.9, offset: 0.2 }, { transform: 'scaleX(0.6) translateX(-30%)', opacity: 0 }], { duration: 220, delay: delay + i * 45, iterations: Math.max(1, Math.round(duration / 220)), fill: 'none' }))
  const cheer = (delay: number) => {
    anim(q('.arm-l'), [{}, { transform: 'rotate(125deg)', offset: 0.3 }, { transform: 'rotate(95deg)', offset: 0.6 }, { transform: 'rotate(125deg)' }, { transform: 'rotate(0)' }], { duration: 900, delay, easing: EASE })
    anim(q('.arm-r'), [{}, { transform: 'rotate(-125deg)', offset: 0.3 }, { transform: 'rotate(-95deg)', offset: 0.6 }, { transform: 'rotate(-125deg)' }, { transform: 'rotate(0)' }], { duration: 900, delay, easing: EASE })
    anim(q('.body'), [{}, { transform: 'translateY(-24%) scale(0.95, 1.06)', offset: 0.32 }, { transform: 'scale(1.1, 0.9)', offset: 0.55 }, { transform: 'translateY(-10%)', offset: 0.75 }, { transform: 'none' }], { duration: 900, delay, easing: EASE })
    mood('o', delay)
    mood('smile', delay + 700)
  }
  const wake = (delay = 0) => { show(shut, false, delay); show([...lids, ...pupils], true, delay); eyes(1, delay, 200) }
  const limb = (sel: string, frames: string[], duration: number, delay = 0) => anim(q(sel), frames.map(t => ({ transform: t })), { duration, delay, easing: EASE })
  const wave = (delay = 0) => limb('.arm-r', ['rotate(0)', 'rotate(-140deg)', 'rotate(-110deg)', 'rotate(-140deg)', 'rotate(-110deg)', 'rotate(0)'], 1100, delay)
  const shake = (delay = 0) => anim(q('.body'), [{}, { transform: 'rotate(-7deg)' }, { transform: 'rotate(6deg)' }, { transform: 'rotate(-4deg)' }, { transform: 'none' }], { duration: 480, delay, easing: EASE })
  const think = (delay = 0) => limb('.arm-r', ['rotate(0)', 'rotate(-75deg)'], 300, delay)
  const rest = (delay = 0) => ['.arm-l', '.arm-r', '.body'].forEach(sel => anim(q(sel), [{}, { transform: 'none' }], { duration: 260, delay, easing: EASE }))
  eyes(1, 0, 1)
  return { q, look, eyes, sleep, wake, mood, brow, flutter, lines, cheer, wave, shake, think, rest }
}

// A burst of sticker-shards from a point on screen (celebrations); cleans itself up
export function stickerBurst(x: number, y: number, count = 14, palette = ['#ffd60a', '#f0302a', '#00c46a', '#2f6bff', '#ff8a00', '#f6f6f2']) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const layer = document.body.appendChild(node('<div class="burst-layer" aria-hidden="true"></div>'))
  const done = Array.from({ length: count }, (_, i) => {
    const size = 10 + Math.random() * 10, a = (i / count) * Math.PI * 2 + Math.random() * 0.4, v = 140 + Math.random() * 180
    const el = layer.appendChild(node(`<i class="shard" style="left:${x - size / 2}px; top:${y - size / 2}px; width:${size}px; height:${size}px; background:${palette[i % palette.length]}"></i>`))
    const frames: Keyframe[] = Array.from({ length: 6 }, (_, k) => {
      const t = (k / 5) * 0.7
      return { transform: `translate(${Math.cos(a) * v * t}px, ${Math.sin(a) * v * t - 120 * t + 500 * t * t}px) rotate(${k * 90}deg)`, opacity: k < 4 ? 1 : 1 - (k - 3) / 2 }
    })
    return el.animate(frames, { duration: 800, easing: 'linear', fill: 'both' }).finished
  })
  Promise.all(done).then(() => layer.remove())
}
