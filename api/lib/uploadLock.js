const MAX_CONCURRENT = 2
const MAX_WAITING = 16

let active = 0
const waiting = []

export class UploadBusyError extends Error {
  constructor(message = 'The album is busy. Your photo will retry shortly.') {
    super(message)
    this.name = 'UploadBusyError'
    this.status = 429
  }
}

export function withUploadLock(fn) {
  return new Promise((resolve, reject) => {
    if (active + waiting.length >= MAX_CONCURRENT + MAX_WAITING) {
      reject(new UploadBusyError())
      return
    }

    const run = async () => {
      active += 1
      try {
        resolve(await fn())
      } catch (error) {
        reject(error)
      } finally {
        active -= 1
        const next = waiting.shift()
        if (next) next()
      }
    }

    if (active < MAX_CONCURRENT) run()
    else waiting.push(run)
  })
}
