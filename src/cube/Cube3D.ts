import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { BASE, FRAME, STICKERS, move, type Face, type State } from './model.ts'

export const HEX: Record<string, string> = { w: '#f6f6f2', y: '#ffd60a', r: '#f0302a', o: '#ff8a00', g: '#00c46a', b: '#2f6bff', _: '#3a3f4b' }
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const expo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t))
const DIST = 11

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
  private onPointer?: (e: PointerEvent) => void
  private cubies: THREE.Mesh[] = []
  private stickers: THREE.Mesh[] = []
  private mats = Object.fromEntries(Object.entries(HEX).map(([k, c]) => [k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.32 })]))
  private tween: ((now: number) => void) | null = null
  private target = new THREE.Quaternion()
  private queue = Promise.resolve()
  private controls?: OrbitControls
  private ro: ResizeObserver
  private host: HTMLElement

  constructor(host: HTMLElement, state: State, interactive = true, followPointer = false) {
    this.host = host
    this.state = state
    const { renderer, scene, camera } = this
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    host.appendChild(renderer.domElement)
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture
    const sun = new THREE.DirectionalLight('#ffffff', 1.2)
    sun.position.set(3, 6, 4)
    this.rig.add(this.group)
    scene.add(sun, this.rig)
    camera.position.set(5.2, 4.3, 7.4).setLength(DIST)
    camera.lookAt(0, 0, 0)

    const body = new RoundedBoxGeometry(0.96, 0.96, 0.96, 3, 0.1)
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#0e0f12', roughness: 0.45 })
    const sticker = roundedSquare(0.41, 0.1)
    const byPos = new Map<string, THREE.Mesh>()
    STICKERS.forEach(({ pos, normal }) => {
      let c = byPos.get(pos.join())
      if (!c) {
        c = new THREE.Mesh(body, bodyMat)
        c.userData.home = pos
        c.position.set(...pos)
        byPos.set(pos.join(), c)
        this.cubies.push(c)
        this.group.add(c)
      }
      const m = new THREE.Mesh(sticker, this.mats._)
      m.position.set(...normal).multiplyScalar(0.485)
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...normal))
      c.add(m)
      this.stickers.push(m)
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
      this.rig.rotation.set(t.x, (1 - e) * -2.2 + t.y + spin, 0)
      this.group.quaternion.slerp(this.target, 0.1)
      this.controls?.update()
      renderer.render(scene, camera)
    })
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
    this.stickers.forEach((m, i) => (m.material = this.mats[s[i]] ?? this.mats._))
  }

  // Animate one move (queued); ms = 0 applies it instantly
  play(m: string, ms = 520) {
    return (this.queue = this.queue.then(() => new Promise<void>(done => {
      const next = move(this.state, m)
      if (!ms) return done(this.setState(next))
      const [axis, layer, sin] = BASE[m[0]]
      const amount = m.endsWith('2') ? 2 : m.endsWith("'") ? -1 : 1
      const pivot = new THREE.Group()
      this.group.add(pivot)
      const layerCubies = this.cubies.filter(c => layer === null || c.userData.home[axis] === layer)
      layerCubies.forEach(c => pivot.attach(c))
      const angle = (sin * amount * Math.PI) / 2
      const dur = ms * (amount === 2 ? 1.4 : 1)
      const t0 = performance.now()
      const lift = layer === null ? 0 : layer * 0.09
      this.tween = now => {
        const t = Math.min(1, (now - t0) / dur)
        pivot.rotation[(['x', 'y', 'z'] as const)[axis]] = angle * ease(t)
        pivot.position.setComponent(axis, lift * Math.sin(Math.PI * t)) // turning layer lifts out slightly
        if (t < 1) return
        layerCubies.forEach(c => { this.group.add(c); c.position.set(...(c.userData.home as [number, number, number])); c.quaternion.identity() })
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

  // Victory spin of the whole cube
  spin() { this.spinAt = performance.now() }

  dispose() {
    this.renderer.setAnimationLoop(null)
    if (this.onPointer) removeEventListener('pointermove', this.onPointer)
    this.ro.disconnect()
    this.controls?.dispose()
    this.scene.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose() } })
    Object.values(this.mats).forEach(m => m.dispose())
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
