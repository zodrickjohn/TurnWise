// A solve as a short video: an offscreen cube plays every move while a 2D canvas adds the brand, the step and the move
import { Cube3D, HEX } from './cube/Cube3D.ts'
import type { Size, State } from './cube/model.ts'

const W = 720, H = 860, TOP = 96, CUBE = 600
export const canRecord = typeof MediaRecorder !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype
const TYPES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']

type Clip = { start: State; size: Size; moves: { m: string; step: string }[]; title: string; face: (k: number) => string }
export async function recordSolve({ start, size, moves, title, face }: Clip, progress: (f: number) => void): Promise<File> {
  const host = Object.assign(document.createElement('div'), { style: `position:fixed;left:-${W * 2}px;top:0;width:${W}px;height:${CUBE}px` })
  document.body.append(host)
  const cube = new Cube3D(host, start, false, false, size)
  const out = Object.assign(document.createElement('canvas'), { width: W, height: H }), g = out.getContext('2d')!
  const gl = host.querySelector('canvas')!
  let caption = { step: 'Scrambled', m: '', c: '_' }, done = 0
  const text = (s: string, x: number, y: number, font: string, color = '#000') => { g.font = font; g.fillStyle = color; g.letterSpacing = font.includes('Lexend') ? '-1.5px' : '0px'; g.fillText(s, x, y) }
  const box = (x: number, y: number, w: number, h: number, r: number, fill: string) => {
    g.beginPath(); g.roundRect(x + 5, y + 5, w, h, r); g.fillStyle = '#000'; g.fill()
    g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = fill; g.fill(); g.lineWidth = 4; g.strokeStyle = '#000'; g.stroke()
  }
  // Drawn right after each 3D frame, while its pixels are still there
  cube.onFrame = () => {
    g.fillStyle = '#eef0f4'; g.fillRect(0, 0, W, H)
    g.fillStyle = '#0000000d'
    for (let x = 0; x < W; x += 30) g.fillRect(x, 0, 1, H)
    for (let y = 0; y < H; y += 30) g.fillRect(0, y, W, 1)
    g.drawImage(gl, 0, TOP, W, CUBE)
    g.fillStyle = '#000'; g.beginPath(); g.roundRect(32, 26, 48, 48, 10); g.fill()
    ;['#ffd60a', '#ff8a00', '#00c46a', '#2f6bff', '#f6f6f2', '#f0302a', '#00c46a', '#ffd60a', '#2f6bff'].forEach((c, i) => {
      g.fillStyle = c; g.beginPath(); g.roundRect(36 + (i % 3) * 14.5, 30 + ((i / 3) | 0) * 14.5, 12, 12, 3); g.fill()
    })
    text('Turnwise', 94, 62, '800 28px "Lexend Mega"')
    g.textAlign = 'right'; text(title, W - 32, 60, '700 22px "Atkinson Hyperlegible"', '#2a2e37'); g.textAlign = 'left'
    box(32, H - 140, W - 64, 104, 22, '#fff')
    text(caption.step, 60, H - 96, '800 24px "Lexend Mega"')
    text(`Move ${done} of ${moves.length}`, 60, H - 60, '700 21px "Atkinson Hyperlegible"', '#2a2e37')
    if (caption.m) {
      box(W - 150, H - 124, 92, 72, 16, caption.c === 'rot' ? '#fff' : HEX[caption.c] ?? '#fff')
      g.textAlign = 'center'; text(caption.m, W - 104, H - 75, '800 32px "Lexend Mega"', caption.c === 'b' ? '#fff' : '#000'); g.textAlign = 'left'
    }
    g.fillStyle = '#000'; g.fillRect(32, H - 22, (W - 64) * (done / moves.length), 6)
  }
  const type = TYPES.find(t => MediaRecorder.isTypeSupported(t)) ?? ''
  const rec = new MediaRecorder(out.captureStream(30), type ? { mimeType: type } : {}), parts: Blob[] = []
  rec.ondataavailable = e => e.data.size && parts.push(e.data)
  const stopped = new Promise(r => (rec.onstop = r))
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
  const ms = Math.min(420, Math.max(70, 16000 / moves.length)) // every solve lands near 20 seconds
  try {
    rec.start()
    await wait(1700) // the cube's entrance, then a beat on the scramble
    for (const [k, t] of moves.entries()) {
      caption = { step: t.step, m: t.m, c: face(k) }
      await cube.play(t.m, ms)
      done = k + 1
      progress(done / moves.length)
    }
    caption = { step: 'Solved!', m: '', c: '_' }
    cube.spin()
    await wait(2200)
    rec.stop()
    await stopped
  } finally {
    cube.dispose()
    host.remove()
  }
  const ext = rec.mimeType.includes('mp4') ? 'mp4' : 'webm'
  return new File(parts, `turnwise-solve.${ext}`, { type: rec.mimeType.split(';')[0] })
}

// Hand the file over: the share sheet on phones, a download elsewhere
export async function saveFile(file: File) {
  if (navigator.share && navigator.canShare?.({ files: [file] })) return navigator.share({ files: [file], title: 'My Turnwise solve' }).catch(() => {})
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: file.name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
