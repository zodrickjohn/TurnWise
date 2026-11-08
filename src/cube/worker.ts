// Runs solver tasks off the main thread: a 5×5 takes a second or two, and the page should stay responsive meanwhile
import { runTask, type Task } from './bigsolve.ts'

const post = (x: unknown) => (self as unknown as { postMessage: (m: unknown) => void }).postMessage(x)
self.onmessage = (e: MessageEvent<Task>) => {
  try { post({ ok: runTask(e.data) }) } catch (err) { post({ error: (err as Error).message }) }
}
