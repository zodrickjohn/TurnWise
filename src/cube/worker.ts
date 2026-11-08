// Runs solver tasks off the main thread and stays alive, so tables built for one question serve the next
import { runTask, type Task } from './bigsolve.ts'

const post = (x: unknown) => (self as unknown as { postMessage: (m: unknown) => void }).postMessage(x)
self.onmessage = (e: MessageEvent<{ id: number; task: Task }>) => {
  try { post({ id: e.data.id, ok: runTask(e.data.task) }) } catch (err) { post({ id: e.data.id, error: (err as Error).message }) }
}
