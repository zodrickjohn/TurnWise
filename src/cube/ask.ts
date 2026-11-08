// One way to ask the solver anything: 2×2 and 3×3 answer at once, 4×4 and 5×5 think in a worker
import { runTask, type Task } from './bigsolve.ts'

export function ask<T>(task: Task): Promise<T> {
  if (task.size <= 3) return Promise.resolve().then(() => runTask(task) as T)
  return new Promise<T>((ok, fail) => {
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = e => { w.terminate(); e.data.error ? fail(new Error(e.data.error)) : ok(e.data.ok) }
    w.onerror = e => { w.terminate(); fail(new Error(e.message || 'Planning failed. Try again.')) }
    w.postMessage(task)
  })
}
