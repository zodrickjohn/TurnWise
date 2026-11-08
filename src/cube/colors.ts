// Sticker color recognition for camera scans: nearest reference color in CIE Lab
export type RGB = [number, number, number]

// Typical camera readings of each sticker color; replaced by the scanned centers as faces come in
export const DEFAULT_REF: Record<string, RGB> = {
  w: [205, 208, 205], y: [215, 200, 45], r: [180, 35, 45], o: [235, 115, 35], g: [30, 160, 90], b: [35, 85, 190],
}

export function lab([r, g, b]: RGB): RGB {
  const lin = (c: number) => ((c /= 255) > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92)
  const [R, G, B] = [lin(r), lin(g), lin(b)]
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047), y = f(R * 0.2126 + G * 0.7152 + B * 0.0722), z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883)
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

// Lightness counts half: shadows change brightness far more than hue
export function classify(px: RGB, refs: Record<string, RGB> = DEFAULT_REF) {
  const [L, A, B] = lab(px)
  let best = '', min = Infinity
  for (const [c, ref] of Object.entries(refs)) {
    const [l, a, b] = lab(ref)
    const d = ((L - l) * 0.5) ** 2 + (A - a) ** 2 + (B - b) ** 2
    if (d < min) (min = d), (best = c)
  }
  return best
}

// Average color of a square region of an RGBA pixel buffer
export function average(data: Uint8ClampedArray): RGB {
  const sum = [0, 0, 0]
  for (let i = 0; i < data.length; i += 4) for (let k = 0; k < 3; k++) sum[k] += data[i + k]
  const n = data.length / 4
  return sum.map(v => Math.round(v / n)) as RGB
}

const dist = (p: RGB, q: RGB) => { const [L, A, B] = lab(p), [l, a, b] = lab(q); return ((L - l) * 0.5) ** 2 + (A - a) ** 2 + (B - b) ** 2 }

// Classify many stickers at once and learn the lighting: each color's reference moves to the mean of its stickers.
// fixed: labels already known (a fixed center). cap: no color takes more stickers than a real cube has (N² each)
export function classifyAll(px: RGB[], fixed: (string | null)[] = [], cap = Infinity) {
  let refs = { ...DEFAULT_REF }, labels: string[] = []
  for (let round = 0; round < 4; round++) {
    labels = px.map((_, i) => fixed[i] ?? '')
    const count: Record<string, number> = Object.fromEntries(Object.keys(refs).map(c => [c, labels.filter(l => l === c).length]))
    // Closest pairs first, so each color fills with its most certain stickers before hitting its cap
    const pairs = px.flatMap((p, i) => (labels[i] ? [] : Object.entries(refs).map(([c, r]) => [dist(p, r), i, c] as const))).sort((a, b) => a[0] - b[0])
    for (const [, i, c] of pairs) if (!labels[i] && count[c] < cap) { labels[i] = c; count[c]++ }
    refs = Object.fromEntries(Object.entries(refs).map(([c, r]) => {
      const mine = px.filter((_, i) => labels[i] === c)
      return [c, mine.length ? ([0, 1, 2].map(k => Math.round(mine.reduce((t, p) => t + p[k], 0) / mine.length)) as RGB) : r]
    }))
  }
  return { labels, refs }
}
