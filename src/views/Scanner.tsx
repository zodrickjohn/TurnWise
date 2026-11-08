import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { SCHEME, type Face, type Size } from '../cube/model.ts'
import { average, classify, classifyAll, type RGB } from '../cube/colors.ts'
import { Icon, KIT, LABEL, ORDER, colorName } from '../ui.tsx'

const GUIDE = 0.62 // guide square as a share of the frame's short side; CSS .scan-guide matches it
// finish: what the last screen says and its button (defaults to reviewing on the paint screen)
type Props = { start: Face; onFaces: (faces: Partial<Record<Face, string[]>>, next: Face) => void; onClose: () => void; finish?: [string, string]; size?: Size }

// Camera scanner for any size: live per-sticker detection, with colors re-learned from every saved face.
// Odd cubes anchor on their fixed centers; once all six faces are in, no color may take more than N² stickers
export default function Scanner({ start, onFaces, onClose, finish, size = 3 }: Props) {
  const n = size, cells = n * n, mid = n % 2 ? ((n - 1) / 2) * (n + 1) : -1 // the fixed center's cell on odd cubes
  const dialog = useRef<HTMLDialogElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [saved, setSaved] = useState<Partial<Record<Face, RGB[]>>>({})
  // Fixed when the scanner opens; the paint screen's face selection moves while scanning
  const [queue] = useState(() => [...ORDER.slice(ORDER.indexOf(start)), ...ORDER.slice(0, ORDER.indexOf(start))])
  const [k, setK] = useState(0)
  const [live, setLive] = useState<RGB[] | null>(null)
  const [error, setError] = useState('')
  const [mirror, setMirror] = useState(false)
  const done = k >= 6
  const face = queue[Math.min(k, 5)]

  useEffect(() => {
    dialog.current?.showModal()
    let alive = true, stream: MediaStream | undefined
    if (!navigator.mediaDevices?.getUserMedia) setError("This browser can't open the camera here. Paint the stickers by hand instead.")
    else navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
      .then(s => {
        if (!alive) return s.getTracks().forEach(t => t.stop())
        stream = s
        video.current!.srcObject = s
        setMirror(s.getVideoTracks()[0].getSettings().facingMode !== 'environment')
      })
      .catch(() => setError("Turnwise can't use your camera. Allow camera access from your browser's address bar, or paint the stickers by hand."))
    // Sample the N×N guide cells a few times a second from the raw (unmirrored) frame
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const timer = setInterval(() => {
      const v = video.current
      if (!v || v.readyState < 2 || !v.videoWidth) return
      const w = (canvas.width = v.videoWidth), h = (canvas.height = v.videoHeight)
      ctx.drawImage(v, 0, 0)
      const cell = (Math.min(w, h) * GUIDE) / n, x0 = (w - cell * n) / 2, y0 = (h - cell * n) / 2, r = cell * 0.2
      setLive(Array.from({ length: cells }, (_, i) => average(ctx.getImageData(x0 + ((i % n) + 0.5) * cell - r, y0 + (((i / n) | 0) + 0.5) * cell - r, 2 * r, 2 * r).data)))
    }, 220)
    return () => { alive = false; clearInterval(timer); stream?.getTracks().forEach(t => t.stop()) }
  }, [])

  // Read every saved face together: shared lighting, fixed centers as anchors, and the N² cap once the cube is complete
  const readAll = (faces: Partial<Record<Face, RGB[]>>) => {
    const list = Object.entries(faces) as [Face, RGB[]][]
    const px = list.flatMap(([, p]) => p), fixed = list.flatMap(([f]) => Array.from({ length: cells }, (_, i) => (i === mid ? SCHEME[f] : null)))
    const { labels, refs } = classifyAll(px, fixed, list.length === 6 ? cells : Infinity)
    return { refs, faces: Object.fromEntries(list.map(([f], j) => [f, labels.slice(j * cells, (j + 1) * cells)])) as Partial<Record<Face, string[]>> }
  }
  const learned = useMemo(() => readAll(saved).refs, [saved])
  const seenCenter = live && !done && mid >= 0 ? classify(live[mid], learned) : null
  const wrongFace = !!seenCenter && seenCenter !== SCHEME[face]
  const colors = live && !done ? live.map((p, i) => (i === mid && !wrongFace ? SCHEME[face] : classify(p, learned))) : null

  // The paint screen's layout: N² per face, except a 2×2, which lives in the corners of the 3×3 layout
  const toState = (c: string[]) => (size === 2 ? Array.from({ length: 9 }, (_, i) => c[[0, -1, 1, -1, -1, -1, 2, -1, 3][i]] ?? '_') : c)
  const saveFace = () => {
    if (!live) return
    const next = { ...saved, [face]: live }
    setSaved(next)
    onFaces(Object.fromEntries(Object.entries(readAll(next).faces).map(([f, c]) => [f, toState(c!)])), queue[Math.min(k + 1, 5)])
    setK(k + 1)
  }

  return (
    <dialog ref={dialog} className="scanner" onClose={onClose} aria-labelledby="scan-title">
      <div className="scan-head">
        <div>
          <p className="step-of">{done ? 'All faces scanned' : `Face ${k + 1} of 6`}</p>
          <h2 id="scan-title">{done ? 'Scan complete' : `Show the ${LABEL[face].toLowerCase()} face`}</h2>
        </div>
        <button className="btn white icon" onClick={() => dialog.current?.close()} aria-label="Close scanner"><Icon name="close" /></button>
      </div>

      {error ? (
        <div className="scan-body">
          <p className="error" role="alert">{error}</p>
          <button className="btn yellow" onClick={() => dialog.current?.close()}>Paint by hand</button>
        </div>
      ) : done ? (
        <div className="scan-body">
          <p>{finish?.[0] ?? "All six faces are in. The detected colors are now on the paint screen: check each face against your cube, fix any sticker that's off, then press Solve."}</p>
          <button className="btn yellow" onClick={() => dialog.current?.close()}>{finish?.[1] ?? 'Review my cube'} <Icon name="arrow" size={18} /></button>
        </div>
      ) : (
        <>
          <p className="scan-hold">{mid >= 0 && <span className={'dot c-' + SCHEME[face]} />} {KIT[size].hold[face]} Fill the square with the face.</p>
          <div className="scan-view">
            <video ref={video} autoPlay playsInline muted className={mirror ? 'mirror' : ''} />
            <div className={'scan-guide' + (mirror ? ' mirror' : '')} style={{ '--n': n } as CSSProperties} aria-hidden="true">
              {Array.from({ length: cells }, (_, i) => <i key={i}>{colors && <b className={'c-' + colors[i]} />}</i>)}
            </div>
            {!live && <p className="scan-wait">Starting camera…</p>}
          </div>
          <p className={'scan-status' + (wrongFace ? ' warn' : '')} aria-live="polite">
            {!colors ? 'Point the camera at the face.' : wrongFace
              ? `That center looks ${colorName(seenCenter!)}. Turn the ${colorName(SCHEME[face])} center toward the camera.`
              : 'The dots show what Turnwise sees. Save when they match your cube.'}
          </p>
          <div className="scan-actions">
            <button className="btn white" disabled={k === 0} onClick={() => setK(k - 1)}>Back</button>
            <button className="btn ghost" onClick={() => setK(k + 1)}>Skip</button>
            <button className="btn yellow" disabled={!live} onClick={saveFace}>Save {LABEL[face].toLowerCase()} face</button>
          </div>
        </>
      )}
    </dialog>
  )
}
