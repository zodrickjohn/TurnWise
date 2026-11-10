import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Cube3D } from '../cube/Cube3D.ts'
import { SOLVED, invertMove, move, scramble } from '../cube/model.ts'
import { STAGES, solve, timeline } from '../cube/solver.ts'
import { wait } from '../cubie.ts'
import { CubeView, LEVEL_MOVES, LEVEL_NAME, Mini, PHASES, Tiles, faceColor, phaseOf, reduceMotion } from '../ui.tsx'
import { LEVELS } from '../cube/methods.ts'
import { PATTERNS } from '../cube/patterns.ts'
import type { View } from '../App.tsx'

// Scroll-through solve: the cube is locked to scroll vertically and springs sideways into the active step's slot
const TURN = 640 // ms per turn, slow enough to follow each layer
const FEAT = 8 // featured turns per step
const W = 11 // sideways spring stiffness
const MAXV = 2400 // px/s cap on the followed speed: steady scrolls track with no lag, flicks get smoothed
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export function ScrollSolve() {
  const cube = useRef<Cube3D>(null)
  const body = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLOListElement>(null)
  const ride = useRef<HTMLDivElement>(null)
  const d = useMemo(() => {
    const start = move(SOLVED, scramble(22))
    const plan = solve(start)
    const { moves, states } = timeline(start, plan)
    const ends = STAGES.map((_, k) => moves.findLastIndex(t => t.stage <= k) + 1)
    const from = (k: number) => (k <= 0 ? 0 : ends[k - 1])
    const feat = STAGES.map((_, k) => Math.min(FEAT, moves.slice(from(k), ends[k]).filter(t => t.chunk === 0).length))
    return { plan, moves, states, ends, from, feat }
  }, [])
  const [k, setK] = useState(0) // active step; 8 = solved
  const [i, setI] = useState(-1) // turn being shown in the active step

  useEffect(() => {
    const el = ride.current!, phone = matchMedia('(max-width: 960px)')
    let x = NaN, vx = 0, ptx = NaN, last = performance.now(), size = '', active = 0, raf = 0
    const show = (a: number) => { if (a !== active) { active = a; setK(a) } }
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.max(0.001, Math.min(0.05, (now - last) / 1000))
      last = now
      const rows = [...list.current!.children] as HTMLElement[]
      const texts = rows.map(r => r.querySelector('.ss-text')!.getBoundingClientRect())
      // Crossing k: starts when step k's text reaches `line`, ends when step k+1's text is centred in the reading area
      const progress = (line: number, middle: number) => {
        let p = 0
        for (let k = 0; k < texts.length - 1; k++) {
          const a = texts[k].top - line, b = texts[k + 1].top + texts[k + 1].height / 2 - middle
          p += clamp01(-a / (b - a))
        }
        const n = Math.min(rows.length - 2, Math.floor(p))
        return [n, clamp01(p - n)] as const
      }
      // Phones: the cube stays in a band pinned under the header while the steps scroll beneath it. Between steps it dips
      // and swells with the scroll and swaps to the next step at the smallest point, so it is never off screen or empty
      if (phone.matches) {
        const band = el.getBoundingClientRect().bottom, [n, e] = progress(band, (band + innerHeight) / 2)
        el.style.transform = el.style.width = el.style.height = ''
        ;(el.firstElementChild as HTMLElement).style.transform = `scale(${(1 - 0.3 * Math.sin(Math.PI * e)).toFixed(3)})`
        if (cube.current) cube.current.yaw = Math.sin(Math.PI * e) * (n % 2 ? -0.6 : 0.6) // a small turn while it dips
        return show(n + (e >= 0.5 ? 1 : 0))
      }
      ;(el.firstElementChild as HTMLElement).style.transform = ''
      const slots = rows.map(r => r.querySelector<HTMLElement>('.ss-slot')!)
      const mid = innerHeight / 2 - body.current!.getBoundingClientRect().top
      const centers = rows.map(r => r.offsetTop + r.offsetHeight / 2)
      const [n, e] = progress(document.querySelector('.bar')!.getBoundingClientRect().bottom, innerHeight / 2) // linear: the spring eases both ends
      const A = slots[n], B = slots[n + 1]
      const y = A.offsetTop + (B.offsetTop - A.offsetTop) * e + Math.max(-50, Math.min(50, (mid - centers[n] - (centers[n + 1] - centers[n]) * e) * 0.14)) // trails the page a little: depth
      const lefts = slots.map(s => s.offsetLeft), lo = Math.min(...lefts), span = Math.max(...lefts) - lo
      const tx = A.offsetLeft + (B.offsetLeft - A.offsetLeft) * e
      if (isNaN(x) || reduceMotion) { x = tx; vx = 0 }
      const vt = isNaN(ptx) ? 0 : Math.max(-MAXV, Math.min(MAXV, (tx - ptx) / dt)) // feed-forward the target's speed
      ptx = tx
      vx += (W * W * (tx - x) + 2 * W * (vt - vx)) * dt
      x += vx * dt
      const side = clamp01((x - lo) / span) // 0 left column, 1 right column
      const scale = 1 - 0.52 * Math.sin(Math.PI * side) // shrink while crossing so the cube never covers text
      const sz = `${A.offsetWidth}x${A.offsetHeight}`
      if (sz !== size) { size = sz; el.style.width = A.offsetWidth + 'px'; el.style.height = A.offsetHeight + 'px' }
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`
      if (cube.current) cube.current.yaw = 0.4 - 0.8 * side - Math.max(-0.7, Math.min(0.7, vx * 0.0006)) // face the text, lean into the glide
      // The step changes once the cube has actually crossed to the new step's side
      const a = n + (e >= 0.5 ? 1 : 0)
      if ((slots[a].offsetLeft > lo + span / 2) === side >= 0.5) show(a)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Time-based playback, never tied to scroll speed: a fast scroll just cancels and starts the newest step
  useEffect(() => {
    const c = cube.current
    if (!c) return
    let live = true
    ;(async () => {
      await c.settle() // let a turn already in flight finish
      if (!live) return
      setI(-1)
      if (k === STAGES.length) { c.setState(d.states[d.states.length - 1]); if (!reduceMotion) c.spin(); return }
      const s0 = d.from(k), L = d.feat[k]
      if (reduceMotion || !L) return c.setState(d.states[d.ends[k]])
      c.setState(d.states[s0])
      await wait(900) // let the cube land first
      while (live) {
        for (let n = 0; n < L && live; n++) { setI(n); await c.play(d.moves[s0 + n].m, TURN) }
        if (!live) return
        setI(L)
        await wait(1500)
        for (let n = L - 1; n >= 0 && live; n--) await c.play(invertMove(d.moves[s0 + n].m), 160) // quick rewind
        if (live) setI(-1)
        await wait(700)
      }
    })()
    return () => { live = false }
  }, [k])

  return (
    <section className="ss" aria-labelledby="ss-h">
      <div className="ss-head">
        <h2 id="ss-h">Watch one real scramble get solved</h2>
        <p>Scroll through the eight steps. The cube follows you and plays each step at a pace you can follow.</p>
      </div>
      <div className="ss-body" ref={body}>
        <div className="ss-ride" ref={ride} aria-hidden="true">
          <CubeView cubeRef={cube} initial={d.states[0]} interactive={false} follow />
          <i className="ss-floor" />
        </div>
        <ol className="ss-steps" ref={list}>
          {STAGES.map((st, n) => {
            const s0 = d.from(n), L = d.feat[n], on = n === k
            const moves = d.moves.slice(s0, s0 + L)
            return (
              <li key={n} className={'ss-step' + (on ? ' on' : '')}>
                <div className="ss-text">
                  <p className="ss-n" aria-hidden="true">{String(n + 1).padStart(2, '0')}</p>
                  <p className="ss-phase">Step {n + 1}, {PHASES[phaseOf(n)].name.toLowerCase()}</p>
                  <h3>{st.title}</h3>
                  <p className="ss-goal">{st.goal}</p>
                  {L ? <>
                    <p className="ss-cap">Watch: {d.plan[n][0].title.replace(/^./, ch => ch.toLowerCase())}</p>
                    <Tiles alg={moves.map(t => t.m).join(' ')} colors={moves.map((t, j) => faceColor(d.states[s0 + j], t.m))} at={on ? i : -1} done={on ? i : -1} size="lg" />
                    <p className="ss-more">The rest of the step repeats the same idea: {d.ends[n] - s0} moves in all.</p>
                  </> : <p className="ss-cap">Already done on this scramble.</p>}
                </div>
                <div className="ss-slot" />
              </li>
            )
          })}
          <li className={'ss-step ss-end' + (k === STAGES.length ? ' on' : '')}>
            <div className="ss-text">
              <h3>Solved.</h3>
              <p className="ss-goal">Eight steps, {d.moves.length} moves, every one of them a beginner algorithm. Now do it with yours.</p>
            </div>
            <div className="ss-slot" />
          </li>
        </ol>
      </div>
    </section>
  )
}

// Feature showcase: each tile runs a tiny live demo of what it does, and takes you there
export function Showcase({ go }: { go: (v: View) => void }) {
  const tile = (i: number) => ({ '--i': i }) as CSSProperties
  return (
    <section className="showcase" aria-labelledby="show-h">
      <h2 id="show-h">Everything you need, from scrambled to solved</h2>
      <div className="bento">
        <button className="tile-card t-sizes reveal" style={tile(0)} onClick={() => go('input')}>
          <div className="demo demo-sizes" aria-hidden="true">
            <div className="sizes">{[2, 3, 4, 5].map(n => <Mini key={n} pattern={Array.from({ length: n * n }, (_, i) => 'gyrbow'[(i * 7 + n) % 6]).join('')} label="" />)}</div>
            <div className="levels">{LEVELS.map(l => <span key={l}><b>{LEVEL_NAME[l]}</b> ~{LEVEL_MOVES[3][l]} moves</span>)}</div>
          </div>
          <h3>Any cube, at your level</h3>
          <p>2×2 to 5×5. Learn the beginner's way, step up to intermediate, or follow the shortest solve the computer can find. Move counts shown are for a 3×3.</p>
        </button>
        <button className="tile-card t-learn reveal" style={tile(0)} onClick={() => go('learn')}>
          <div className="demo demo-keys" aria-hidden="true">{["R", "U", "R'", "U'"].map((m, i) => <kbd key={m} style={{ '--d': i } as CSSProperties}>{m}</kbd>)}</div>
          <h3>Learn the moves</h3>
          <p>Read any algorithm in five minutes, then test yourself with a quiz.</p>
        </button>
        <button className="tile-card t-scan reveal" style={tile(1)} onClick={() => go('input')}>
          <div className="demo demo-scan" aria-hidden="true"><div className="vf">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ '--d': i } as CSSProperties} />)}<b className="scanline" /></div></div>
          <h3>Scan your cube</h3>
          <p>Show each face to your camera and Turnwise reads the colors for you.</p>
        </button>
        <button className="tile-card t-detective reveal" style={tile(2)} onClick={() => go('input')}>
          <div className="demo demo-detective" aria-hidden="true"><div className="face">{'ggggrgggg'.split('').map((c, i) => <i key={i} className={'c-' + c + (i === 4 ? ' odd' : '')} />)}</div><span className="lens" /></div>
          <h3>Mistake detective</h3>
          <p>Cube stopped matching the screen? It finds the exact slip and how to undo it.</p>
        </button>
        <button className="tile-card t-practice reveal" style={tile(3)} onClick={() => go('practice')}>
          <div className="demo demo-stars" aria-hidden="true">{[0, 1, 2].map(i => <i key={i} style={{ '--d': i } as CSSProperties} />)}</div>
          <h3>Practice any step</h3>
          <p>Drill one step on screen or on your real cube, and beat the guide's move count.</p>
        </button>
        <button className="tile-card t-sky reveal" style={tile(4)} onClick={() => (document.querySelector('.theme-toggle') as HTMLButtonElement)?.click()}>
          <div className="demo demo-sky" aria-hidden="true"><span className="orb sun" /><span className="orb moon" /></div>
          <h3>Day and night</h3>
          <p>Cubie handles the theme switch personally. Click to see how.</p>
        </button>
        <button className="tile-card t-sizes t-patterns reveal" style={tile(5)} onClick={() => go('patterns')}>
          <div className="demo demo-patterns" aria-hidden="true">
            <div className="sizes">{PATTERNS.slice(0, 5).map(p => <Mini key={p.name} pattern={move(SOLVED, p.alg).slice(18, 27).join('')} label="" />)}</div>
          </div>
          <h3>Make a pattern</h3>
          <p>Checkerboards, spots, a cube inside a cube. Eight patterns to make on your solved cube, and how to undo each one.</p>
        </button>
      </div>
    </section>
  )
}
