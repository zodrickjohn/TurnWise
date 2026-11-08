import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { CAST, cubieMarkup, rig } from './cubie.ts'
import { reduceMotion } from './ui.tsx'

export type CoachMood = 'idle' | 'happy' | 'cheer' | 'wave' | 'think' | 'wow' | 'oops' | 'grit' | 'sleep'

// Cubie as an on-page coach: eyes follow the pointer, blinks and breathes, reacts with a mood, and a speech
// bubble that re-pops whenever what it says changes (sayKey). Poking Cubie gets a little reaction
export function Coach({ mood = 'idle', say, sayKey, size = 92, className = '' }: { mood?: CoachMood; say: ReactNode; sayKey?: string | number; size?: number; className?: string }) {
  const host = useRef<HTMLButtonElement>(null)
  const ctl = useRef<ReturnType<typeof rig> | null>(null)
  const markup = useMemo(() => cubieMarkup(CAST[0], true), [])

  useEffect(() => {
    const el = host.current!
    const c = (ctl.current = rig(el, true))
    const pupils = [...el.querySelectorAll<SVGElement>('.pupil')]
    const follow = (e: PointerEvent) => {
      const b = el.getBoundingClientRect()
      const dx = e.clientX - (b.left + b.width * 0.42), dy = e.clientY - (b.top + b.height * 0.36), d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 260) * 3.6
      pupils.forEach(p => (p.style.transform = `translate(${((dx / d) * k).toFixed(2)}px, ${((dy / d) * k).toFixed(2)}px)`))
    }
    addEventListener('pointermove', follow)
    let timer = 0
    const blink = () => {
      if (!el.classList.contains('asleep')) { c.eyes(0, 0, 70); c.eyes(1, 120, 90) }
      timer = window.setTimeout(blink, 2200 + Math.random() * 3200)
    }
    timer = window.setTimeout(blink, 1400)
    return () => { removeEventListener('pointermove', follow); clearTimeout(timer) }
  }, [])

  useEffect(() => {
    const c = ctl.current!, el = host.current!
    el.classList.toggle('asleep', mood === 'sleep')
    if (mood === 'sleep') return void c.sleep()
    c.wake()
    c.rest()
    const moves = !reduceMotion
    if (mood === 'idle') { c.mood('smile'); c.brow('flat') }
    else if (mood === 'happy') { c.mood('smile'); c.brow('up') }
    else if (mood === 'cheer') { c.brow('up'); if (moves) c.cheer(0); else c.mood('smile') }
    else if (mood === 'wave') { c.mood('smile'); c.brow('up'); if (moves) c.wave() }
    else if (mood === 'think') { c.mood('smile'); c.brow('flat'); if (moves) c.think() }
    else if (mood === 'wow') { c.mood('o'); c.brow('up') }
    else if (mood === 'oops') { c.mood('o'); c.brow('angry'); if (moves) c.shake() }
    else if (mood === 'grit') { c.mood('grit'); c.brow('angry') }
  }, [mood, sayKey])

  const poke = () => { if (reduceMotion) return; const c = ctl.current!; Math.random() < 0.5 ? c.cheer(0) : c.wave() }
  return (
    <div className={'coach ' + className}>
      <button ref={host} type="button" className="coach-cubie" style={{ width: size, height: size * 1.04 }} onClick={poke} aria-label="Cubie, your coach" dangerouslySetInnerHTML={{ __html: markup }} />
      <div className="coach-bubble" key={sayKey} aria-live="polite">{say}</div>
    </div>
  )
}
