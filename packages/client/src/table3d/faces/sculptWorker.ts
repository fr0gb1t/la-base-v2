// The sculptor's worker: the heads and hands take a second or two each to sculpt, which would freeze the table if
// it ran on the page. Jobs come in one at a time and go back as plain arrays.
import { runJob, transferables, type SculptJob } from './sculptJobs'

self.onmessage = (e: MessageEvent<{ id: number; job: SculptJob }>) => {
  const { id, job } = e.data
  try {
    const pieces = runJob(job)
    ;(self as unknown as Worker).postMessage({ id, pieces }, transferables(pieces))
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, error: String(err) })
  }
}
