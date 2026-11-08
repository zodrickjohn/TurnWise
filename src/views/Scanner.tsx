import { useEffect, useRef, useState } from 'react'
import { SCHEME, type Face } from '../cube/model.ts'
import { DEFAULT_REF, average, classify, type RGB } from '../cube/colors.ts'
import { HOLD, Icon, LABEL, ORDER, colorName } from '../ui.tsx'

const GUIDE = 0.62 // guide square as a share of the frame's short side; CSS .scan-guide matches it
type Props = { start: Face; onFaces: (faces: Partial<Record<Face, string[]>>, next: Face) => void; onClose: () => void }

// Camera scanner: live per-sticker detection, calibrated by the center colors of faces already saved
export default function Scanner({ start, onFaces, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const saved = useRef<Partial<Record<Face, RGB[]>>>({})
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
    // Sample the 9 guide cells a few times a second from the raw (unmirrored) frame
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const timer = setInterval(() => {
      const v = video.current
      if (!v || v.readyState < 2 || !v.videoWidth) return
      const w = (canvas.width = v.videoWidth), h = (canvas.height = v.videoHeight)
      ctx.drawImage(v, 0, 0)
      const cell = (Math.min(w, h) * GUIDE) / 3, x0 = (w - cell * 3) / 2, y0 = (h - cell * 3) / 2, r = cell * 0.2
      setLive(Array.from({ length: 9 }, (_, i) => average(ctx.getImageData(x0 + ((i % 3) + 0.5) * cell - r, y0 + (((i / 3) | 0) + 0.5) * cell - r, 2 * r, 2 * r).data)))
    }, 220)
    return () => { alive = false; clearInterval(timer); stream?.getTracks().forEach(t => t.stop()) }
  }, [])

  // References: defaults, overridden by saved faces' centers and the live center of the face in view
  const refsFor = (f: Face, center?: RGB) => {
    const refs = { ...DEFAULT_REF }
    for (const [sf, px] of Object.entries(saved.current)) if (sf !== f) refs[SCHEME[sf as Face]] = px![4]
    if (center) refs[SCHEME[f]] = center
    return refs
  }
  // Calibrate on the face's own center only when it really is that face
  const read = (f: Face, px: RGB[], calibrate = true) => { const refs = refsFor(f, calibrate ? px[4] : undefined); return px.map((p, i) => (i === 4 ? SCHEME[f] : classify(p, refs))) }
  const seenCenter = live && !done ? classify(live[4], refsFor(face)) : null
  const wrongFace = !!seenCenter && seenCenter !== SCHEME[face]
  const colors = live && !done ? read(face, live, !wrongFace) : null

  const saveFace = () => {
    if (!live) return
    saved.current[face] = live
    // Re-read every saved face: each new center sharpens the color references
    onFaces(Object.fromEntries(Object.entries(saved.current).map(([f, px]) => [f, read(f as Face, px!)])), queue[Math.min(k + 1, 5)])
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
          <p>All six faces are in. The detected colors are now on the paint screen: check each face against your cube, fix any sticker that's off, then press Solve.</p>
          <button className="btn yellow" onClick={() => dialog.current?.close()}>Review my cube <Icon name="arrow" size={18} /></button>
        </div>
      ) : (
        <>
          <p className="scan-hold"><span className={'dot c-' + SCHEME[face]} /> {HOLD[face]} Fill the square with the face.</p>
          <div className="scan-view">
            <video ref={video} autoPlay playsInline muted className={mirror ? 'mirror' : ''} />
            <div className={'scan-guide' + (mirror ? ' mirror' : '')} aria-hidden="true">
              {Array.from({ length: 9 }, (_, i) => <i key={i}>{colors && <b className={'c-' + colors[i]} />}</i>)}
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
