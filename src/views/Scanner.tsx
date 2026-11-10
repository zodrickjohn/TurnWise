import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { SCHEME, type Face, type Size } from '../cube/model.ts'
import { average, classify, classifyAll, dist, type RGB } from '../cube/colors.ts'
import { Icon, KIT, LABEL, ORDER, Mini, colorName } from '../ui.tsx'

const GUIDE = 0.62 // guide square as a share of the frame's short side; CSS .scan-guide matches it
// finish: what the last screen says and its button (defaults to reviewing on the paint screen)
// check: scan one face mid-solve and compare it with what the screen expects (N² colors); onWrong runs once the dialog is gone
export type Check = { face: Face; expect: string[]; onWrong: () => void }
type Props = { start: Face; onFaces?: (faces: Partial<Record<Face, string[]>>, next: Face) => void; onClose: () => void; finish?: [string, string]; size?: Size; check?: Check }
const CHECK_HOLD: Partial<Record<Face, string>> = {
  F: 'Hold your cube the way the screen shows it, front toward the camera.',
  U: 'Hold your cube the way the screen shows it, then tip the top toward the camera. The front ends up along the bottom edge.',
  D: 'Hold your cube the way the screen shows it, then tip the bottom toward the camera. The front ends up along the top edge.',
}

// Camera scanner for any size: live per-sticker detection, with colors re-learned from every saved face.
// Odd cubes anchor on their fixed centers; once all six faces are in, no color may take more than N² stickers
export default function Scanner({ start, onFaces, onClose, finish, size = 3, check }: Props) {
  const n = size, cells = n * n, mid = n % 2 ? ((n - 1) / 2) * (n + 1) : -1 // the fixed center's cell on odd cubes
  const dialog = useRef<HTMLDialogElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream>(undefined) // kept so a video element shown again (scan again) gets the camera back
  const attach = (v: HTMLVideoElement | null) => { video.current = v; if (v && stream.current && v.srcObject !== stream.current) v.srcObject = stream.current }
  const [saved, setSaved] = useState<Partial<Record<Face, RGB[]>>>({})
  // Fixed when the scanner opens; the paint screen's face selection moves while scanning
  const [queue] = useState(() => (check ? [check.face] : [...ORDER.slice(ORDER.indexOf(start)), ...ORDER.slice(0, ORDER.indexOf(start))]))
  const faces = queue.length
  const center = (f: Face) => (check ? check.expect[mid] : SCHEME[f]) // a step check knows the center the screen shows
  const then = useRef<() => void>(undefined)
  const [k, setK] = useState(0)
  const [live, setLive] = useState<RGB[] | null>(null)
  const [error, setError] = useState('')
  const [mirror, setMirror] = useState(false)
  const done = k >= faces
  const face = queue[Math.min(k, faces - 1)]

  useEffect(() => {
    dialog.current?.showModal()
    // Back closes the scanner instead of leaving the page: the dialog gets its own history entry
    history.pushState({ ...history.state, modal: true }, '')
    const back = () => dialog.current?.close()
    addEventListener('popstate', back)
    let alive = true
    if (!navigator.mediaDevices?.getUserMedia) setError("This browser can't open the camera here. Paint the stickers by hand instead.")
    else navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
      .then(s => {
        if (!alive) return s.getTracks().forEach(t => t.stop())
        stream.current = s
        attach(video.current)
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
    return () => { alive = false; clearInterval(timer); stream.current?.getTracks().forEach(t => t.stop()); removeEventListener('popstate', back) }
  }, [])

  // Read every saved face together: shared lighting, fixed centers as anchors, and the N² cap once the cube is complete
  const readAll = (faces: Partial<Record<Face, RGB[]>>) => {
    const list = Object.entries(faces) as [Face, RGB[]][]
    const px = list.flatMap(([, p]) => p), fixed = list.flatMap(([f]) => Array.from({ length: cells }, (_, i) => (i === mid ? center(f) : null)))
    const { labels, refs } = classifyAll(px, fixed, list.length === 6 ? cells : Infinity)
    return { refs, faces: Object.fromEntries(list.map(([f], j) => [f, labels.slice(j * cells, (j + 1) * cells)])) as Partial<Record<Face, string[]>> }
  }
  const learned = useMemo(() => readAll(saved).refs, [saved])
  const seenCenter = live && !done && mid >= 0 ? classify(live[mid], learned) : null
  const wrongFace = !!seenCenter && seenCenter !== center(face)
  const colors = live && !done ? live.map((p, i) => (i === mid && !wrongFace ? center(face) : classify(p, learned))) : null

  // The paint screen's layout: N² per face, except a 2×2, which lives in the corners of the 3×3 layout
  const toState = (c: string[]) => (size === 2 ? Array.from({ length: 9 }, (_, i) => c[[0, -1, 1, -1, -1, -1, 2, -1, 3][i]] ?? '_') : c)
  const saveFace = () => {
    if (!live) return
    const next = { ...saved, [face]: live }
    setSaved(next)
    onFaces?.(Object.fromEntries(Object.entries(readAll(next).faces).map(([f, c]) => [f, toState(c!)])), queue[Math.min(k + 1, faces - 1)])
    setK(k + 1)
  }

  // Step check: a sticker counts as matching when the expected color is nearly as close as the best guess (red and orange blur)
  const result = check && done && saved[face] ? (() => {
    const { faces: f, refs } = readAll(saved), seen = f[face]!, px = saved[face]!
    return { seen, off: seen.flatMap((c, i) => (c === check.expect[i] || dist(px[i], refs[check.expect[i]]) <= 1.6 * dist(px[i], refs[c]) ? [] : [i])) }
  })() : null

  // Closing goes back past the dialog's own history entry first, so whatever runs next lands on a settled history
  const closed = () => {
    const after = () => { onClose(); then.current?.() }
    if (!history.state?.modal) return after()
    addEventListener('popstate', after, { once: true })
    history.back()
  }
  return (
    <dialog ref={dialog} className="scanner" onClose={closed} aria-labelledby="scan-title">
      <div className="scan-head">
        <div>
          <p className="step-of">{check ? 'Step check' : done ? 'All faces scanned' : `Face ${k + 1} of 6`}</p>
          <h2 id="scan-title">{result ? (result.off.length ? 'Something looks different' : 'Your cube matches') : done ? 'Scan complete' : `Show the ${LABEL[face].toLowerCase()} face`}</h2>
        </div>
        <button className="btn white icon" onClick={() => dialog.current?.close()} aria-label="Close scanner"><Icon name="close" /></button>
      </div>

      {error ? (
        <div className="scan-body">
          <p className="error" role="alert">{error}</p>
          <button className="btn yellow" onClick={() => dialog.current?.close()}>Paint by hand</button>
        </div>
      ) : result ? (
        <div className="scan-body">
          <div className="check-faces">
            <figure><Mini pattern={check!.expect.join('')} label={`The ${LABEL[face].toLowerCase()} face on screen`} /><figcaption>On screen</figcaption></figure>
            <figure><Mini pattern={result.seen.join('')} off={result.off} label={`Your ${LABEL[face].toLowerCase()} face, as the camera saw it`} /><figcaption>Your cube</figcaption></figure>
          </div>
          <p>{result.off.length
            ? `${result.off.length} sticker${result.off.length > 1 ? 's look' : ' looks'} different (circled). If the camera misread a color, scan again. If your cube really is different, the mistake detective can find the slip.`
            : 'Every sticker on this face is where the screen says. Carry on with the next move.'}</p>
          <div className="scan-actions">
            {result.off.length ? <>
              <button className="btn white" onClick={() => { setSaved({}); setLive(null); setK(0) }}>Scan again</button>
              <button className="btn yellow" onClick={() => { then.current = check!.onWrong; dialog.current?.close() }}><Icon name="search" size={18} /> Find the slip</button>
            </> : <button className="btn yellow" onClick={() => dialog.current?.close()}>Carry on <Icon name="arrow" size={18} /></button>}
          </div>
        </div>
      ) : done ? (
        <div className="scan-body">
          <p>{finish?.[0] ?? "All six faces are in. The detected colors are now on the paint screen: check each face against your cube, fix any sticker that's off, then press Solve."}</p>
          <button className="btn yellow" onClick={() => dialog.current?.close()}>{finish?.[1] ?? 'Review my cube'} <Icon name="arrow" size={18} /></button>
        </div>
      ) : (
        <>
          <p className="scan-hold">{mid >= 0 && <span className={'dot c-' + center(face)} />} {check ? CHECK_HOLD[face] : KIT[size].hold[face]} Fill the square with the face.</p>
          <div className="scan-view">
            <video ref={attach} autoPlay playsInline muted className={mirror ? 'mirror' : ''} />
            <div className={'scan-guide' + (mirror ? ' mirror' : '')} style={{ '--n': n } as CSSProperties} aria-hidden="true">
              {Array.from({ length: cells }, (_, i) => <i key={i}>{colors && <b className={'c-' + colors[i]} />}</i>)}
            </div>
            {!live && <p className="scan-wait">Starting camera…</p>}
          </div>
          <p className={'scan-status' + (wrongFace ? ' warn' : '')} aria-live="polite">
            {!colors ? 'Point the camera at the face.' : wrongFace
              ? `That center looks ${colorName(seenCenter!)}. Turn the ${colorName(center(face))} center toward the camera.`
              : 'The dots show what Turnwise sees. Save when they match your cube.'}
          </p>
          <div className="scan-actions">
            {!check && <>
              <button className="btn white" disabled={k === 0} onClick={() => setK(k - 1)}>Back</button>
              <button className="btn ghost" onClick={() => setK(k + 1)}>Skip</button>
            </>}
            <button className="btn yellow" disabled={!live} onClick={saveFace}>{check ? 'Check this face' : `Save ${LABEL[face].toLowerCase()} face`}</button>
          </div>
        </>
      )}
    </dialog>
  )
}
