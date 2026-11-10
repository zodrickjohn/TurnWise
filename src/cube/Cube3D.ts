import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { BASE, FRAME, STICKERS, isCorner, move, toMoves, type Face, type Size, type State, type V } from './model.ts'
import { bigCube, turnOf } from './big.ts'

export const HEX: Record<string, string> = { w: '#f6f6f2', y: '#ffd60a', r: '#f0302a', o: '#ff8a00', g: '#00c46a', b: '#2f6bff', _: '#3a3f4b' }
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const expo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t))
const DIST = 11
const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)]

function roundedSquare(h: number, r: number) {
  const s = new THREE.Shape()
  s.moveTo(-h + r, -h).lineTo(h - r, -h).quadraticCurveTo(h, -h, h, -h + r).lineTo(h, h - r).quadraticCurveTo(h, h, h - r, h)
    .lineTo(-h + r, h).quadraticCurveTo(-h, h, -h, h - r).lineTo(-h, -h + r).quadraticCurveTo(-h, -h, -h + r, -h)
  return new THREE.ShapeGeometry(s, 4)
}

// Three.js cube that mirrors a facelet State and animates moves; colors are re-read from state after each turn
export class Cube3D {
  state: State
  private renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
  private group = new THREE.Group()
  private rig = new THREE.Group() // entrance, pointer tilt and victory spin; group inside handles face focus
  private tilt = { x: 0, y: 0, tx: 0, ty: 0 }
  private spinAt = -1
  yaw = 0 // target turn of the whole cube, set from outside; eased toward each frame
  private yawNow = 0
  private onPointer?: (e: PointerEvent) => void
  private sun = new THREE.DirectionalLight('#ffffff', 1.2)
  private dayT = -1
  private cubies: THREE.Mesh[] = []
  private stickers: THREE.Mesh[] = []
  private mats = Object.fromEntries(Object.entries(HEX).map(([k, c]) => [k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.32 })]))
  private tween: ((now: number) => void) | null = null
  private target = new THREE.Quaternion()
  private queue = Promise.resolve()
  private controls?: OrbitControls
  private ro: ResizeObserver
  private host: HTMLElement
  private size: Size = 3
  private turn: (s: State, m: string) => State = move
  private layout = STICKERS
  private gap = 1
  private lit: boolean[] | null = null // follow mode: only these stickers keep full color
  private dims = Object.fromEntries(Object.entries(HEX).map(([k, c]) => [k, new THREE.MeshStandardMaterial({ color: new THREE.Color(c).lerp(new THREE.Color('#1d2027'), 0.86), roughness: 0.6 })]))
  private trails = new THREE.Group()

  constructor(host: HTMLElement, state: State, interactive = true, followPointer = false, size: Size = 3) {
    this.host = host
    this.state = state
    const { renderer, scene, camera } = this
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    host.appendChild(renderer.domElement)
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture
    this.sun.position.set(3, 6, 4)
    this.rig.add(this.group)
    this.size = size
    this.group.scale.setScalar({ 2: 1.4, 3: 1, 4: 0.78, 5: 0.64 }[size]) // every size fills about the same space
    scene.add(this.sun, this.rig)
    camera.position.set(5.2, 4.3, 7.4).setLength(DIST)
    camera.lookAt(0, 0, 0)

    const body = new RoundedBoxGeometry(0.96, 0.96, 0.96, 3, 0.1)
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#0e0f12', roughness: 0.45 })
    const sticker = roundedSquare(0.41, 0.1)
    const byPos = new Map<string, THREE.Mesh>()
    // A 2x2 is the 8 corner cubies pulled in to touch; 4x4 and 5x5 come from the N×N model in doubled coordinates
    const big = size > 3 ? bigCube(size) : null
    if (big) (this.turn = big.move), (this.layout = big.STICKERS)
    const gap = (this.gap = size === 3 ? 1 : 0.5)
    this.group.add(this.trails)
    this.layout.forEach(({ pos, normal }, i) => {
      if (size === 2 && !isCorner(i)) return
      let c = byPos.get(pos.join())
      if (!c) {
        c = new THREE.Mesh(body, bodyMat)
        c.userData.home = pos
        c.userData.at = pos.map(v => v * gap)
        c.position.set(...(c.userData.at as [number, number, number]))
        byPos.set(pos.join(), c)
        this.cubies.push(c)
        this.group.add(c)
      }
      const m = new THREE.Mesh(sticker, this.mats._)
      m.position.set(...normal).multiplyScalar(0.485)
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...normal))
      c.add(m)
      this.stickers[i] = m // sparse on a 2x2: indices stay those of the state
    })
    this.setState(state)

    if (interactive) {
      this.controls = new OrbitControls(camera, renderer.domElement)
      Object.assign(this.controls, { enableZoom: false, enablePan: false, enableDamping: true, rotateSpeed: 0.7 })
    }
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(host)
    this.resize()
    if (followPointer) {
      this.onPointer = e => { this.tilt.tx = (e.clientY / innerHeight - 0.5) * 0.35; this.tilt.ty = (e.clientX / innerWidth - 0.5) * 0.6 }
      addEventListener('pointermove', this.onPointer)
    }
    const born = performance.now()
    renderer.setAnimationLoop(now => {
      this.tween?.(now)
      // Entrance: grow and unwind into place; then ease toward pointer tilt; optional full spin
      const e = expo((now - born) / 1400)
      const t = this.tilt
      t.x += (t.tx - t.x) * 0.06
      t.y += (t.ty - t.y) * 0.06
      const spin = this.spinAt < 0 ? 0 : ease(Math.min(1, (now - this.spinAt) / 1600)) * Math.PI * 2
      this.rig.scale.setScalar(0.6 + 0.4 * e)
      this.yawNow += (this.yaw - this.yawNow) * 0.045
      this.rig.rotation.set(t.x, (1 - e) * -2.2 + t.y + spin + this.yawNow, 0)
      this.group.quaternion.slerp(this.target, 0.1)
      this.light()
      this.controls?.update()
      renderer.render(scene, camera)
    })
  }

  // Match the page's time of day (CSS --t: 0 noon, 1 night)
  private light() {
    const t = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--t')) || 0
    if (Math.abs(t - this.dayT) < 0.001) return
    this.dayT = t
    const gold = Math.sin(Math.min(1, t / 0.6) * Math.PI), dusk = Math.sin(Math.min(1, Math.max(0, (t - 0.32) / 0.6)) * Math.PI)
    this.sun.color.setRGB(1, 1, 1).lerp(new THREE.Color(0.62, 0.72, 1), t).lerp(new THREE.Color(1, 0.62, 0.3), gold * 0.85).lerp(new THREE.Color(0.75, 0.5, 1), dusk * 0.5)
    this.sun.intensity = 1.25 - 0.55 * t + 0.35 * gold
    this.sun.position.set(3 - 7 * t, 6 - 4 * gold, 4) // the sun drops low and swings across
    this.scene.environmentIntensity = 1 - 0.5 * t
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.host
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.position.setLength(w < h ? DIST * (h / w) ** 0.85 : DIST)
    this.camera.updateProjectionMatrix()
  }

  setState(s: State) {
    this.state = s
    this.stickers.forEach((m, i) => (m.material = (this.lit && !this.lit[i] ? this.dims : this.mats)[s[i]] ?? this.mats._))
  }

  // Which cubies a move turns, about which axis and how far: the 3x3 table, or the N×N notation (slices, wide turns, x y z)
  private spec(m: string) {
    const t = this.size > 3 ? turnOf(this.size, m) : null
    const [axis, layer, sin] = t ? [t.axis, null, t.sine] : BASE[m[0]]
    const amount = t ? (t.amount === 3 ? -1 : t.amount) : m.endsWith('2') ? 2 : m.endsWith("'") ? -1 : 1
    const has = (p: V) => (t ? t.layers.includes(p[axis]) : layer === null || p[axis] === layer)
    return { axis, layer, has, angle: (sin * amount * Math.PI) / 2, quarters: Math.abs(amount) }
  }

  // Follow mode: light only the stickers at these positions (null = all) and draw the path each piece takes through alg.
  // Paths arc out a little mid-turn, so the turning layer's corners don't hide them
  follow(at: number[] | null, alg = '') {
    this.lit = at && this.stickers.map((_, i) => at.includes(i))
    this.setState(this.state)
    this.trails.children.forEach(o => { (o as THREE.Mesh).geometry.dispose(); ((o as THREE.Mesh).material as THREE.Material).dispose() })
    this.trails.clear()
    // One path per piece, from its cubie pushed out past the stickers; the outline keeps it readable on any color
    const pieces = new Map<string, number>()
    for (const j of at ?? []) if (!pieces.has(this.layout[j].pos.join())) pieces.set(this.layout[j].pos.join(), j)
    for (const j of pieces.values()) {
      const c = new THREE.Vector3(...this.layout[j].pos).multiplyScalar(this.gap)
      const p = c.clone().addScaledVector(c.lengthSq() ? c.clone().normalize() : new THREE.Vector3(...this.layout[j].normal), 0.75)
      const pts = [p.clone()]
      let k = j
      for (const m of toMoves(alg)) {
        if (/^[xyz]/.test(m)) break // turning the whole cube moves no piece: the path picks up again after it
        const { axis, has, angle, quarters } = this.spec(m)
        if (has(this.layout[k].pos)) {
          const ax = AXES[axis], q = angle / quarters
          for (let n = 0; n < quarters; n++) for (let t = 1; t <= 10; t++) {
            const r = p.clone().applyAxisAngle(ax, q * (n + t / 10)), along = ax.clone().multiplyScalar(r.dot(ax))
            pts.push(r.sub(along).multiplyScalar(1 + 0.3 * Math.sin((Math.PI * t) / 10)).add(along))
          }
          p.applyAxisAngle(ax, angle)
        }
        k = this.turn(this.state.map((_, i) => (i === k ? '1' : '0')), m).indexOf('1')
      }
      if (pts.length < 2) continue
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), seg = pts.length * 3
      // The black copy shows only its back faces, so it reads as an outline around the colored fill
      const ink = new THREE.MeshBasicMaterial({ color: '#000', side: THREE.BackSide }), fill = new THREE.MeshBasicMaterial({ color: HEX[this.state[j]] ?? HEX._ })
      const dot = (r: number, m: THREE.Material) => { const d = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m); d.position.copy(pts.at(-1)!); return d }
      this.trails.add(new THREE.Mesh(new THREE.TubeGeometry(curve, seg, 0.075, 8), ink), new THREE.Mesh(new THREE.TubeGeometry(curve, seg, 0.045, 8), fill), dot(0.17, ink.clone()), dot(0.13, fill.clone()))
    }
  }

  // Animate one move (queued); ms = 0 applies it instantly
  play(m: string, ms = 520) {
    return (this.queue = this.queue.then(() => new Promise<void>(done => {
      const next = this.turn(this.state, m)
      if (this.lit) this.lit = this.turn(this.lit.map(b => (b ? '1' : '0')), m).map(c => c === '1') // lit stickers travel with their pieces
      if (!ms) return done(this.setState(next))
      const { axis, layer, has, angle, quarters } = this.spec(m)
      const pivot = new THREE.Group()
      this.group.add(pivot)
      const layerCubies = this.cubies.filter(c => has(c.userData.home))
      layerCubies.forEach(c => pivot.attach(c))
      const dur = ms * (quarters === 2 ? 1.4 : 1)
      const t0 = performance.now()
      const lift = layer === null ? 0 : layer * 0.09
      this.tween = now => {
        const k = Math.min(1, (now - t0) / dur)
        pivot.rotation[(['x', 'y', 'z'] as const)[axis]] = angle * ease(k)
        pivot.position.setComponent(axis, lift * Math.sin(Math.PI * k)) // turning layer lifts out slightly
        if (k < 1) return
        layerCubies.forEach(c => { this.group.add(c); c.position.set(...(c.userData.at as [number, number, number])); c.quaternion.identity() })
        this.group.remove(pivot)
        this.tween = null
        this.setState(next)
        done()
      }
    })))
  }

  // Turn the whole cube to present one face to the viewer (null = default view)
  focusFace(f: Face | null) {
    if (!f) return void this.target.identity()
    const [n, , r, d] = FRAME[f]
    const face = new THREE.Matrix4().makeBasis(new THREE.Vector3(...r), new THREE.Vector3(...d).negate(), new THREE.Vector3(...n))
    this.camera.updateMatrixWorld()
    const tilt = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.28, -0.38, 0))
    this.target.setFromRotationMatrix(new THREE.Matrix4().extractRotation(this.camera.matrixWorld).multiply(tilt).multiply(face.transpose()))
  }

  // Resolves once every queued turn has finished animating
  settle() { return this.queue }

  // Victory spin of the whole cube
  spin() { this.spinAt = performance.now() }

  dispose() {
    this.renderer.setAnimationLoop(null)
    if (this.onPointer) removeEventListener('pointermove', this.onPointer)
    this.ro.disconnect()
    this.controls?.dispose()
    this.scene.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose() } })
    Object.values(this.mats).forEach(m => m.dispose())
    Object.values(this.dims).forEach(m => m.dispose())
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
