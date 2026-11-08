// Theme switch as a full-screen action short. The sun (or moon) steps out of the toggle into the sky. Caped
// Cubie charges in while two mini-Cubies cheer, leaps, and kicks it: hit-stop, flash, POW. It ricochets and
// sets, the other light rises, and the cast falls asleep (or cheers). The time of day changes on the kick
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const SPRING = 'cubic-bezier(0.34, 1.4, 0.64, 1)' // character overshoot: squash and stretch settle past their mark
const IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)'
const FALL = 'cubic-bezier(0.5, 0, 0.75, 0)'
const CAST = [
  ['#ffd60a', '#f0302a', '#00c46a', '#2f6bff', '#f6f6f2', '#ff8a00', '#00c46a', '#ffd60a', '#f0302a'],
  ['#2f6bff', '#2f6bff', '#f6f6f2', '#00c46a', '#2f6bff', '#ffd60a', '#2f6bff', '#f0302a', '#2f6bff'],
  ['#ff8a00', '#f0302a', '#ff8a00', '#ffd60a', '#ff8a00', '#ff8a00', '#00c46a', '#ff8a00', '#f6f6f2'],
]
type Mood = 'smile' | 'grit' | 'o' | 'yawn'

const node = (html: string) => {
  const t = document.createElement('template')
  t.innerHTML = html.trim()
  return t.content.firstElementChild as HTMLElement
}
const anim = (e: Element, k: Keyframe[], o: KeyframeAnimationOptions) => e.animate(k, { fill: 'both', ...o })
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const pivot = (o: string) => `style="transform-box: fill-box; transform-origin: ${o}"`
const show = (els: Element[], on: boolean, delay = 0, duration = 90) => els.forEach(e => anim(e, [{}, { opacity: on ? 1 : 0 }], { duration, delay }))

// An isometric Cubie: front face with eyes, brows and mouths, a lit top face, a shaded side face, sneakers,
// and optionally a cape. Feet stand on the ground line at x
function spawnCubie(stage: HTMLElement, size: number, x: number, ground: number, stickers: string[], cape = false) {
  const h = size * 1.04
  const tops = [...stickers].reverse(), sides = [...stickers.slice(3), ...stickers.slice(0, 3)]
  const el = stage.appendChild(node(`<div class="actor" style="left:${x - size / 2}px; top:${ground - h}px; width:${size}px; height:${h}px">
  <svg viewBox="-16 -6 100 100" width="${size}" height="${h}" aria-hidden="true">
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
  <div class="speed-lines">${'<i></i>'.repeat(5)}</div></div>`))
  const shadow = stage.insertBefore(node(`<i class="actor-shadow" style="left:${x - size * 0.38}px; top:${ground - 6}px; width:${size * 0.76}px"></i>`), el)
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
  eyes(1, 0, 1)
  return { el, shadow, q, look, eyes, sleep, mood, brow, flutter, lines, cheer, size, x }
}

// Sun and moon with faces that react: calm, shocked (O mouth, wide eyes), then dizzy (spiral eyes)
const face = (cx: number, sleepy: boolean) => `
  <g class="calm">${sleepy
    ? `<path d="M${cx - 6} -1 q2 2 4 0 M${cx + 2} -1 q2 2 4 0" stroke="#000" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M${cx - 3} 5 q3 2.5 6 0" stroke="#000" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
    : `<circle cx="${cx - 4}" cy="-1.5" r="1.5" fill="#000"/><circle cx="${cx + 4}" cy="-1.5" r="1.5" fill="#000"/><path d="M${cx - 5} 3 Q${cx} 7.5 ${cx + 5} 3" stroke="#000" stroke-width="1.8" fill="none" stroke-linecap="round"/>`}</g>
  <g class="shock" opacity="0"><circle cx="${cx - 4}" cy="-2" r="2.6" fill="#fff" stroke="#000" stroke-width="1.3"/><circle cx="${cx + 4}" cy="-2" r="2.6" fill="#fff" stroke="#000" stroke-width="1.3"/><circle cx="${cx - 4}" cy="-2" r="1" fill="#000"/><circle cx="${cx + 4}" cy="-2" r="1" fill="#000"/><ellipse cx="${cx}" cy="5" rx="2.4" ry="3" fill="#000"/></g>
  <g class="dizzy" opacity="0" stroke="#000" stroke-width="1.3" fill="none" stroke-linecap="round"><path d="M${cx - 4} -2 m-2.4 0 a2.4 2.4 0 1 1 2.4 2.4 a1.4 1.4 0 1 1 1.2 -1.6"/><path d="M${cx + 4} -2 m-2.4 0 a2.4 2.4 0 1 1 2.4 2.4 a1.4 1.4 0 1 1 1.2 -1.6"/><path d="M${cx - 3} 5.5 q1.5 -1.5 3 0 q1.5 1.5 3 0"/></g>`
const sunSvg = () => `<svg viewBox="-24 -24 48 48" aria-hidden="true">
  <g class="rays">${Array.from({ length: 10 }, (_, i) => `<rect x="-2.6" y="-23" width="5.2" height="9" rx="2.6" fill="#ffd60a" stroke="#000" stroke-width="1.8" transform="rotate(${i * 36})"/>`).join('')}</g>
  <circle r="11.5" fill="#ffd60a" stroke="#000" stroke-width="2.6"/><circle cx="-4.5" cy="-5" r="2.6" fill="#fff9"/>
  <circle cx="-7" cy="3" r="1.8" fill="#ff8a00" opacity="0.6"/><circle cx="7" cy="3" r="1.8" fill="#ff8a00" opacity="0.6"/>${face(0, false)}</svg>`
const moonSvg = () => `<svg viewBox="-24 -24 48 48" aria-hidden="true">
  <path d="M4 -17 A17 17 0 1 0 17 6 A13 13 0 1 1 4 -17 Z" fill="#f6f6f2" stroke="#000" stroke-width="2.6" stroke-linejoin="round"/>
  <circle cx="-1" cy="11" r="1.8" fill="#0002"/><circle cx="-12" cy="-5" r="1.5" fill="#0002"/><circle cx="-10" cy="4" r="1.6" fill="#f0302a" opacity="0.35"/>${face(-7, true)}</svg>`
const orbFace = (orb: Element, f: 'calm' | 'shock' | 'dizzy', delay = 0) => (['calm', 'shock', 'dizzy'] as const).forEach(k => show([orb.querySelector(`.${k}`)!], k === f, delay))

// Comic starburst with a word in it
const burst = (word: string) => `<svg viewBox="-100 -100 200 200" aria-hidden="true">
  <polygon points="${Array.from({ length: 28 }, (_, i) => { const r = i % 2 ? 58 : 96 - (i % 4) * 6, a = (i / 28) * Math.PI * 2; return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}` }).join(' ')}" fill="#ffd60a" stroke="#000" stroke-width="5" stroke-linejoin="round"/>
  <polygon points="${Array.from({ length: 20 }, (_, i) => { const r = i % 2 ? 36 : 62, a = (i / 20) * Math.PI * 2 + 0.2; return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}` }).join(' ')}" fill="#f0302a" stroke="#000" stroke-width="4" stroke-linejoin="round"/>
  <text x="0" y="12" text-anchor="middle" transform="rotate(-10)" font-family="Lexend Mega, sans-serif" font-weight="800" font-size="${word.length > 4 ? 30 : 38}" fill="#fff" stroke="#000" stroke-width="5" paint-order="stroke" letter-spacing="-3">${word}</text></svg>`

// Shards morph between a sticker (square) and a star; both polygons have 8 matching points so they interpolate
const SQUARE = 'polygon(0% 0%, 50% 0%, 100% 0%, 100% 50%, 100% 100%, 50% 100%, 0% 100%, 0% 50%)'
const STAR = 'polygon(38% 38%, 50% 0%, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0% 50%)'

let playing = false

// Plays the show; calls swap() at the moment of the kick. Resolves when the stage is gone
export async function themeShow(toggle: HTMLElement, toNight: boolean, swap: () => void) {
  if (playing) return
  playing = true
  const W = innerWidth, H = innerHeight
  const big = Math.round(Math.min(230, Math.max(130, Math.min(W, H) * 0.27)))
  const ground = H - 18
  const t = toggle.getBoundingClientRect()
  const home: [number, number] = [t.left + t.width / 2, t.top + t.height / 2]
  const sky: [number, number] = [W * (W < 700 ? 0.62 : 0.66), H * 0.27]
  const orb = Math.round(big * 0.66)
  const stage = document.body.appendChild(node('<div class="show" aria-hidden="true"></div>'))
  const bubble = (text: string, x: number, y: number, delay: number, flip = false) => {
    const b = stage.appendChild(node(`<div class="bubble${flip ? ' flip' : ''}" style="left:${x}px; top:${y}px">${text}</div>`))
    anim(b, [{ transform: 'scale(0) rotate(-12deg)', opacity: 0 }, { transform: 'scale(1.12) rotate(3deg)', opacity: 1, offset: 0.25 }, { transform: 'scale(1) rotate(0deg)', opacity: 1, offset: 0.8 }, { transform: 'scale(0.9)', opacity: 0 }], { duration: 1100, delay, easing: EASE })
  }
  document.documentElement.classList.add('show-on')

  // 1. The light steps out of the toggle and grows into the sky
  const light = stage.appendChild(node(`<div class="show-light" style="left:${sky[0] - orb / 2}px; top:${sky[1] - orb / 2}px; width:${orb}px; height:${orb}px">${toNight ? sunSvg() : moonSvg()}</div>`))
  anim(light, [{ transform: `translate(${home[0] - sky[0]}px, ${home[1] - sky[1]}px) scale(${22 / orb})` }, { transform: 'translate(0,0) scale(1.1)', offset: 0.8 }, { transform: 'translate(0,0) scale(1)' }], { duration: 700, easing: EASE })
  if (toNight) anim(light.querySelector('.rays')!, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(50deg)' }], { duration: 1700, easing: 'linear' })
  const nightStars = toNight ? [] : Array.from({ length: W < 700 ? 16 : 26 }, (_, i) => {
    const st = stage.appendChild(node(`<i class="show-star" style="left:${Math.random() * W}px; top:${Math.random() * H * 0.6}px"></i>`))
    anim(st, [{ transform: 'scale(0)', opacity: 0 }, { transform: `scale(${(0.5 + Math.random()).toFixed(2)})`, opacity: 1 }], { duration: 500, delay: i * 25, easing: EASE })
    return st
  })

  // 2. The cast: minis pop up in the corners, caped Cubie charges in from the left with speed lines
  const minis = [spawnCubie(stage, big * 0.46, W * 0.1, ground, CAST[1]), spawnCubie(stage, big * 0.42, W * 0.9, ground, CAST[2])]
  minis.forEach((m, i) => {
    anim(m.el, [{ transform: `translateY(${m.size * 1.1}px)` }, { transform: 'translateY(-10px)', offset: 0.7 }, { transform: 'translateY(0)' }], { duration: 520, delay: 200 + i * 140, easing: SPRING })
    m.look(i ? -3 : 3, -3, 600)
    if (!toNight) m.eyes(0.45, 0, 1)
  })
  const hero = spawnCubie(stage, big, W * 0.32, ground, CAST[0], true)
  if (toNight) { hero.mood('grit'); hero.brow('angry') } else { hero.eyes(0.45, 0, 1); hero.brow('flat') }
  const runFrom = -W * 0.32 - big * 1.2, run = 680
  anim(hero.el, [{ transform: `translateX(${runFrom}px) rotate(8deg)` }, { transform: 'translateX(18px) rotate(8deg)', offset: 0.86 }, { transform: 'translateX(0) rotate(0deg)' }], { duration: run, delay: 120, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' })
  anim(hero.shadow, [{ transform: `translateX(${runFrom}px)` }, { transform: 'translateX(0)' }], { duration: run, delay: 120, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' })
  anim(hero.q('.leg-l'), [{ transform: 'rotate(32deg)' }, { transform: 'rotate(-32deg)' }, { transform: 'rotate(32deg)' }], { duration: 200, delay: 120, iterations: 3, fill: 'none' })
  anim(hero.q('.leg-r'), [{ transform: 'rotate(-32deg)' }, { transform: 'rotate(32deg)' }, { transform: 'rotate(-32deg)' }], { duration: 200, delay: 120, iterations: 3, fill: 'none' })
  anim(hero.q('.arm-l'), [{ transform: 'rotate(-40deg)' }, { transform: 'rotate(40deg)' }, { transform: 'rotate(-40deg)' }], { duration: 200, delay: 120, iterations: 3, fill: 'none' })
  anim(hero.q('.arm-r'), [{ transform: 'rotate(40deg)' }, { transform: 'rotate(-40deg)' }, { transform: 'rotate(40deg)' }], { duration: 200, delay: 120, iterations: 3, fill: 'none' })
  anim(hero.q('.body'), [{ transform: 'translateY(0)' }, { transform: 'translateY(-6%)' }, { transform: 'translateY(0)' }], { duration: 100, delay: 120, iterations: 6, fill: 'none' })
  hero.flutter(120, run + 300)
  hero.lines(120, run * 0.8)
  bubble(toNight ? 'GO!' : 'GET IT!', W * 0.1 + big * 0.2, ground - big * 0.46 - 70, 450)
  await wait(120 + run * 0.86)

  // Skid to a stop in a puff of dust; look up at the light
  for (let i = 0; i < 7; i++) {
    const d = stage.appendChild(node(`<i class="show-dust" style="left:${W * 0.32 - big * 0.3 + i * 8}px; top:${ground - 16}px; width:${12 + i * 4}px; height:${12 + i * 4}px"></i>`))
    anim(d, [{ transform: 'translate(0,0) scale(0.4)', opacity: 0.85 }, { transform: `translate(${-34 - i * 14}px, ${-14 - i * 5}px) scale(1.5)`, opacity: 0 }], { duration: 620, delay: i * 22, easing: EASE })
  }
  anim(hero.q('.body'), [{ transform: 'rotate(-14deg) scale(1.08, 0.92)' }, { transform: 'rotate(0deg)' }], { duration: 320, easing: SPRING })
  if (!toNight) { // sleepy hero: a big yawn, then wakes up and gets determined
    hero.mood('yawn')
    hero.eyes(1, 380, 180)
    hero.mood('grit', 420)
    hero.brow('angry', 420)
    minis.forEach(m => m.eyes(1, 420, 200))
  }
  hero.look(5, -5, 100)
  await wait(toNight ? 240 : 560)

  // 3. Anticipation, then a huge leap into a flying kick; the light sees it coming
  await anim(hero.q('.body'), [{ transform: 'none' }, { transform: 'scale(1.18, 0.78) rotate(10deg)' }], { duration: 200, easing: EASE }).finished
  orbFace(light, 'shock')
  anim(light, [{ transform: 'scale(1)' }, { transform: 'scale(1.12) rotate(-8deg)' }, { transform: 'scale(1.06) rotate(6deg)' }], { duration: 300, easing: EASE })
  hero.mood('o')
  const start: [number, number] = [W * 0.32, ground - big * 0.5]
  const strike: [number, number] = [sky[0] - orb * 0.5 - big * 0.44, sky[1] - big * 0.12]
  const dx = strike[0] - start[0], dy = strike[1] - start[1], leap = 320
  anim(hero.el, [{ transform: 'translate(0,0) rotate(0deg)' }, { transform: `translate(${dx}px, ${dy}px) rotate(-20deg)` }], { duration: leap, easing: 'cubic-bezier(0.2, 0.75, 0.35, 1)' })
  anim(hero.shadow, [{ transform: 'scale(1)', opacity: 1 }, { transform: `translateX(${dx}px) scale(0.35)`, opacity: 0.25 }], { duration: leap, easing: EASE })
  anim(hero.q('.body'), [{ transform: 'scale(1.18, 0.78) rotate(10deg)' }, { transform: 'scale(0.88, 1.14) rotate(-6deg)' }], { duration: leap, easing: EASE })
  anim(hero.q('.leg-r'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(38deg)', offset: 0.55 }, { transform: 'rotate(-108deg)' }], { duration: leap, easing: 'cubic-bezier(0.6, 0, 0.2, 1)' })
  anim(hero.q('.leg-l'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(34deg)' }], { duration: leap })
  anim(hero.q('.arm-l'), [{ transform: 'rotate(0)' }, { transform: 'rotate(80deg)' }], { duration: leap })
  anim(hero.q('.arm-r'), [{ transform: 'rotate(0)' }, { transform: 'rotate(-60deg)' }], { duration: leap })
  hero.flutter(0, leap + 500)
  hero.lines(0, leap)
  minis.forEach((m, i) => { m.look(i ? -5 : 5, -5, 80, 180); m.mood('o', 100); m.brow('up', 100) })
  await wait(leap)

  // Impact: hit-stop (everything holds for a beat), a white flash, POW, sparks, rings, and the page jolts
  const contact: [number, number] = [sky[0] - orb * 0.48, sky[1] + big * 0.04]
  const flash = stage.appendChild(node('<i class="show-flash"></i>'))
  anim(flash, [{ opacity: 0 }, { opacity: 0.55, offset: 0.2 }, { opacity: 0 }], { duration: 220 })
  const pow = stage.appendChild(node(`<div class="pow" style="left:${contact[0] - big * 0.55}px; top:${contact[1] - big * 0.95}px; width:${big * 1.1}px; height:${big * 1.1}px">${burst(toNight ? 'POW!' : 'BONK!')}</div>`))
  anim(pow, [{ transform: 'scale(0.2) rotate(-25deg)', opacity: 1 }, { transform: 'scale(1.15) rotate(4deg)', opacity: 1, offset: 0.25 }, { transform: 'scale(1) rotate(0deg)', opacity: 1, offset: 0.75 }, { transform: 'scale(1.3) rotate(6deg)', opacity: 0 }], { duration: 780, easing: EASE })
  const hit = stage.appendChild(node(`<div class="show-hit" style="left:${contact[0] - 90}px; top:${contact[1] - 90}px; width:180px; height:180px"><i class="ring"></i><i class="ring"></i>${'<b></b>'.repeat(14)}</div>`))
  hit.querySelectorAll('.ring').forEach((r, i) => anim(r, [{ transform: 'scale(0.15)', opacity: 1 }, { transform: `scale(${1.5 + i * 0.7})`, opacity: 0 }], { duration: 560, delay: i * 70, easing: EASE }))
  hit.querySelectorAll('b').forEach((s, i) => anim(s, [{ transform: `rotate(${i * 25.7 + 8}deg) translateY(-10px) scaleY(1.4)`, opacity: 1 }, { transform: `rotate(${i * 25.7 + 8}deg) translateY(-${80 + (i % 3) * 22}px) scaleY(0.2)`, opacity: 0 }], { duration: 500, easing: EASE }))
  for (const el of [document.querySelector('main'), document.querySelector('.bar')]) if (el) anim(el, [{ transform: 'none' }, { transform: 'translate(-12px, 6px)' }, { transform: 'translate(9px, -5px)' }, { transform: 'translate(-5px, 3px)' }, { transform: 'translate(2px, -1px)' }, { transform: 'none' }], { duration: 400, delay: 110, fill: 'none' })
  minis.forEach((m, i) => m.cheer(80 + i * 90))
  swap()
  await wait(110) // hit-stop

  // 4. The light shatters. Its dazed core shrinks while sticker-shards burst out with real physics (spin, gravity)
  orbFace(light, 'dizzy')
  const rays = light.querySelector('.rays')
  if (rays) anim(rays, [{}, { transform: 'scale(1.8)', opacity: 0 }], { duration: 180, easing: EASE })
  anim(light, [{}, { transform: 'scale(0.62) rotate(-35deg)', offset: 0.35 }, { transform: 'scale(0.56) rotate(-18deg)' }], { duration: 600, easing: EASE })
  const palette = toNight ? ['#ffd60a', '#ff8a00', '#ffe680', '#ffb703'] : ['#f6f6f2', '#dfe6f5', '#c9dbff', '#ffffff']
  const count = W < 700 ? 22 : 34
  const shards = Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI + (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
    const speed = 380 + Math.random() * 560
    const vx = Math.cos(angle) * speed + 240, vy = Math.sin(angle) * speed - 220 // the kick pushes right and up
    const size = orb * (0.13 + Math.random() * 0.13), color = palette[i % palette.length], spin = (Math.random() - 0.5) * 1500
    const el = stage.appendChild(node(`<i class="shard" style="left:${sky[0] - size / 2}px; top:${sky[1] - size / 2}px; width:${size}px; height:${size}px"></i>`))
    // Burst: sampled ballistic flight. Then glide to a spot in the night sky (becoming a star) or back into the core
    const fly: Keyframe[] = Array.from({ length: 7 }, (_, k) => {
      const tt = (k / 6) * 0.5
      return { transform: `translate(${vx * tt}px, ${vy * tt + 550 * tt * tt}px) rotate(${spin * tt}deg)`, clipPath: SQUARE, background: color, offset: (k / 6) * 0.42 }
    })
    fly[6].easing = 'cubic-bezier(0.45, 0, 0.2, 1)'
    const tx = toNight ? W * (0.04 + Math.random() * 0.92) : sky[0], ty = toNight ? H * (0.05 + Math.random() * 0.58) : sky[1]
    fly.push({ transform: `translate(${tx - sky[0]}px, ${ty - sky[1]}px) rotate(${toNight ? 45 : spin}deg) scale(${toNight ? (0.55 + Math.random() * 0.6).toFixed(2) : 0.15})`, clipPath: toNight ? STAR : SQUARE, background: toNight ? '#fff6c4' : '#ffd60a', offset: 1 })
    anim(el, fly, { duration: toNight ? 1500 : 1200, delay: i * 6, easing: 'linear' })
    if (toNight) anim(el, [{ opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }], { duration: 700 + Math.random() * 600, delay: 1600 + Math.random() * 400, iterations: 4, fill: 'none' })
    return el
  })

  // The core flips like a coin and comes back around as the other light
  const flipTo = async (svg: string, onSwap?: () => void) => {
    await anim(light, [{}, { transform: 'scale(0.56) rotateY(90deg)' }], { duration: 200, easing: FALL }).finished
    light.innerHTML = svg
    onSwap?.() // runs exactly when the new face is in place
    return anim(light, [{ transform: 'scale(0.56) rotateY(-90deg)' }, { transform: 'scale(1.15) rotateY(0deg)', offset: 0.6 }, { transform: 'scale(1) rotateY(0deg)' }], { duration: 560, easing: EASE }).finished
  }

  // Cubie drops back to earth, lands with a shockwave, strikes a pose and watches it go
  const land = (dx) * 0.55
  anim(hero.el, [{ transform: `translate(${dx}px, ${dy}px) rotate(-20deg)` }, { transform: `translate(${land}px, 0) rotate(0deg)` }], { duration: 460, easing: FALL })
  anim(hero.shadow, [{ transform: `translateX(${dx}px) scale(0.35)`, opacity: 0.25 }, { transform: `translateX(${land}px) scale(1)`, opacity: 1 }], { duration: 460, easing: FALL })
  anim(hero.q('.leg-r'), [{ transform: 'rotate(-108deg)' }, { transform: 'rotate(0deg)' }], { duration: 400, delay: 30, easing: SPRING })
  anim(hero.q('.leg-l'), [{ transform: 'rotate(34deg)' }, { transform: 'rotate(0deg)' }], { duration: 400, delay: 30, easing: SPRING })
  anim(hero.q('.arm-l'), [{ transform: 'rotate(80deg)' }, { transform: 'rotate(0deg)' }], { duration: 400, delay: 30, easing: SPRING })
  anim(hero.q('.arm-r'), [{ transform: 'rotate(-60deg)' }, { transform: 'rotate(-150deg)', offset: 0.7 }, { transform: 'rotate(-140deg)' }], { duration: 700, delay: 380, easing: EASE }) // victory fist
  anim(hero.q('.body'), [{ transform: 'scale(0.88, 1.14) rotate(-6deg)' }, { transform: 'scale(0.9, 1.12)', offset: 0.55 }, { transform: 'scale(1.2, 0.76)', offset: 0.66 }, { transform: 'scale(0.95, 1.05)', offset: 0.82 }, { transform: 'none' }], { duration: 760, easing: 'linear' })
  hero.mood('smile', 420)
  hero.brow('flat', 420)
  const shock = stage.appendChild(node(`<i class="shockwave" style="left:${start[0] + land - big * 0.7}px; top:${ground - 14}px; width:${big * 1.4}px"></i>`))
  anim(shock, [{ transform: 'scale(0.2)', opacity: 0.9 }, { transform: 'scale(1.3)', opacity: 0 }], { duration: 520, delay: 400, easing: EASE })
  for (const c of [hero, ...minis]) c.look(-5, 5, 520, 900)

  // 5. Night: the sun's core cools into the moon, its shards are now the stars, shooting stars cross, the cast sleeps.
  //    Morning: the shards and every star spiral back into the core, which ignites into the sun
  for (const c of [hero, ...minis]) c.look(5, -5, 250, 700)
  if (toNight) {
    await wait(460)
    await flipTo(moonSvg())
    anim(light, [{ transform: 'translateY(0)' }, { transform: 'translateY(-8px)' }, { transform: 'translateY(0)' }], { duration: 900, iterations: 2, fill: 'none', easing: IN_OUT })
    for (let i = 0; i < 3; i++) {
      const ss = stage.appendChild(node(`<i class="shooting" style="left:${W * (0.12 + i * 0.28)}px; top:${H * (0.08 + i * 0.07)}px"></i>`))
      anim(ss, [{ transform: 'translate(0,0) rotate(28deg) scaleX(0)', opacity: 0 }, { transform: 'translate(60px,30px) rotate(28deg) scaleX(1)', opacity: 1, offset: 0.3 }, { transform: 'translate(260px,140px) rotate(28deg) scaleX(0.3)', opacity: 0 }], { duration: 800, delay: 150 + i * 260, easing: 'cubic-bezier(0.3, 0, 0.6, 1)' })
    }
    for (const [i, c] of [hero, ...minis].entries()) { // goodnight: the whole cast nods off, z's drift up
      c.sleep(100 + i * 110)
      const left = c.x + c.size * 0.3 + (i === 0 ? land : 0), top = ground - c.size * 1.04
      for (let k = 0; k < 3; k++) {
        const z = stage.appendChild(node(`<span class="show-z" style="left:${left + k * 6}px; top:${top + c.size * 0.1}px; font-size:${Math.round(c.size * (0.1 + k * 0.035))}px">z</span>`))
        anim(z, [{ transform: 'translate(0,0)', opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: `translate(${10 + k * 8}px, -${c.size * (0.3 + k * 0.12)}px)`, opacity: 0 }], { duration: 1000, delay: 300 + i * 110 + k * 160, easing: EASE })
      }
    }
    await wait(520)
  } else {
    nightStars.forEach((st, i) => {
      const r = st.getBoundingClientRect()
      anim(st, [{}, { transform: `translate(${(sky[0] - r.left - r.width / 2) * 0.4}px, ${(sky[1] - r.top) * 0.4 - 40}px) rotate(180deg) scale(0.8)`, offset: 0.5 },
        { transform: `translate(${sky[0] - r.left - r.width / 2}px, ${sky[1] - r.top - r.height / 2}px) rotate(400deg) scale(0)`, opacity: 0.4 }], { duration: 900, delay: 150 + i * 18, easing: 'cubic-bezier(0.55, 0, 0.75, 0.4)' })
    })
    await wait(900)
    const ignite = stage.appendChild(node(`<div class="show-hit" style="left:${sky[0] - 110}px; top:${sky[1] - 110}px; width:220px; height:220px"><i class="ring"></i><i class="ring"></i></div>`))
    ignite.querySelectorAll('.ring').forEach((r, i) => anim(r, [{ transform: 'scale(0.1)', opacity: 1 }, { transform: `scale(${1.4 + i * 0.6})`, opacity: 0 }], { duration: 600, delay: i * 90, easing: EASE }))
    await flipTo(sunSvg(), () => {
      anim(light.querySelector('.rays')!, [{ transform: 'scale(0.3) rotate(-120deg)' }, { transform: 'scale(1.6) rotate(0deg)', offset: 0.6 }, { transform: 'scale(1) rotate(25deg)' }], { duration: 900, easing: EASE })
      bubble('MORNING!', W * 0.9 - big * 0.9, ground - big * 0.42 - 70, 100, true)
      for (const [i, c] of [hero, ...minis].entries()) c.cheer(80 + i * 90)
    })
    await wait(320)
  }
  shards.forEach(sh => anim(sh, [{}, { opacity: 0 }], { duration: 500 }))
  const homeward = `translate(${home[0] - sky[0]}px, ${home[1] - sky[1]}px)`
  const fly = anim(light, [{ transform: 'translate(0,0) scale(1)' }, { transform: `${homeward} scale(${30 / orb}, ${16 / orb})`, offset: 0.82 }, { transform: `${homeward} scale(${22 / orb})` }], { duration: 560, easing: IN_OUT })
  await fly.finished
  document.documentElement.classList.remove('show-on')
  await wait(toNight ? 260 : 120)

  // 6. Curtain: everyone ducks out of view
  const exits = [hero, ...minis].map((c, i) => anim(c.el, [{}, { transform: `translate(${i === 0 ? land : 0}px, ${c.size * 1.2}px)` }], { duration: 360, delay: i * 60, easing: FALL }).finished)
  stage.querySelectorAll('.actor-shadow').forEach(s => anim(s, [{}, { opacity: 0 }], { duration: 300 }))
  await Promise.all(exits)
  stage.remove()
  playing = false
}
