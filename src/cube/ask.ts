// Ask the solver anything: quick 2×2/3×3 beginner work answers at once, the rest goes to one long-lived worker that keeps its tables
import { runTask, type Task } from './bigsolve.ts'

let worker: Worker | null = null, seq = 0
const waiting = new Map<number, [(v: unknown) => void, (e: Error) => void]>()
const start = () => {
  const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  w.onmessage = (e: MessageEvent<{ id: number; ok?: unknown; error?: string }>) => {
    const [ok, fail] = waiting.get(e.data.id) ?? []
    waiting.delete(e.data.id)
    if (e.data.error) fail?.(new Error(e.data.error)); else ok?.(e.data.ok)
  }
  w.onerror = e => { waiting.forEach(([, fail]) => fail(new Error(e.message || 'Planning failed. Try again.'))); waiting.clear(); worker = null; w.terminate() }
  return w
}

export function ask<T>(task: Task): Promise<T> {
  if (task.size <= 3 && (task.kind !== 'plan' || (task.level ?? 'beginner') === 'beginner')) return Promise.resolve().then(() => runTask(task) as T)
  const id = ++seq
  return new Promise<T>((ok, fail) => {
    waiting.set(id, [ok as (v: unknown) => void, fail])
    ;(worker ??= start()).postMessage({ id, task })
  })
}
