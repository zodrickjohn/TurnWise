// Plans a solve off the main thread: a 5×5 takes a second or two, and the page should stay responsive meanwhile
import { prepareAny } from './bigsolve.ts'
import type { Size, State } from './model.ts'

const post = (x: unknown) => (self as unknown as { postMessage: (m: unknown) => void }).postMessage(x)
self.onmessage = (e: MessageEvent<{ cube: State; size: Size }>) => {
  try { post(prepareAny(e.data.cube, e.data.size)) } catch (err) { post({ error: (err as Error).message }) }
}
