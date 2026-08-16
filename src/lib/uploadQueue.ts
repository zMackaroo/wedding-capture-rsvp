import { apiUrl } from './api'
import {
  fileFromPending,
  listPending,
  removePending,
  savePending,
  type PendingUpload,
} from './uploadStore'

export type ApiPhoto = {
  id: string
  url: string
  mimeType?: string
  kind?: 'image' | 'video'
}

export type QueueStatus = 'queued' | 'uploading' | 'retrying' | 'error'

export type QueueEvent =
  | { type: 'status'; id: string; status: QueueStatus; progress?: number }
  | { type: 'success'; id: string; photo: ApiPhoto }
  | { type: 'error'; id: string; message: string; retryable: boolean }
  | { type: 'online'; online: boolean }

type Listener = (event: QueueEvent) => void

type MemoryItem = {
  id: string
  file: File
  createdAt: number
  attempts: number
  nextRetryAt: number
  lastError: string | null
  cancelled: boolean
}

const MAX_CONCURRENT = 2
export const MAX_UPLOAD_ATTEMPTS = 8
const BASE_DELAY_MS = 4000
const MAX_DELAY_MS = 60_000
const SCHEDULER_MS = 10_000
const UPLOAD_TIMEOUT_MS = 75_000

const items = new Map<string, MemoryItem>()
const inFlight = new Set<string>()
const listeners = new Set<Listener>()
const uploads = new Map<string, XMLHttpRequest>()

let schedulerStarted = false
let restored = false
let restorePromise: Promise<void> | null = null

function emit(event: QueueEvent) {
  listeners.forEach((listener) => listener(event))
}

function backoffMs(attempts: number) {
  const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1))
  return exp + Math.floor(Math.random() * 700)
}

function isRetryableStatus(status: number) {
  return [408, 425, 429, 500, 502, 503, 504].includes(status)
}

function isRetryableError(error: unknown, status?: number) {
  if (status && isRetryableStatus(status)) return true
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  if (error instanceof TypeError) return true
  if (error instanceof DOMException && error.name === 'NetworkError') return true
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('failed to fetch') ||
    message.includes('offline')
  )
}

async function persist(item: MemoryItem) {
  const record: PendingUpload = {
    id: item.id,
    name: item.file.name,
    type: item.file.type,
    blob: item.file,
    createdAt: item.createdAt,
    attempts: item.attempts,
    nextRetryAt: item.nextRetryAt,
    lastError: item.lastError,
  }
  await savePending(record)
}

function remember(record: PendingUpload): MemoryItem {
  const existing = items.get(record.id)
  if (existing) return existing
  const item: MemoryItem = {
    id: record.id,
    file: fileFromPending(record),
    createdAt: record.createdAt,
    attempts: record.attempts,
    nextRetryAt: record.nextRetryAt,
    lastError: record.lastError,
    cancelled: false,
  }
  items.set(item.id, item)
  return item
}

function uploadWithProgress(
  id: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<ApiPhoto> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', apiUrl('/api/photos'))
    xhr.timeout = UPLOAD_TIMEOUT_MS
    uploads.set(id, xhr)

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress(Math.round((event.loaded / event.total) * 100))
    }

    xhr.onload = () => {
      const retryAfter = Number(xhr.getResponseHeader('Retry-After'))
      let payload: { photos?: ApiPhoto[]; error?: string }
      try {
        payload = JSON.parse(xhr.responseText) as { photos?: ApiPhoto[]; error?: string }
      } catch {
        payload = {}
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        const uploaded = payload.photos?.[0]
        if (!uploaded) {
          reject(Object.assign(new Error('Could not save photo'), { status: xhr.status }))
          return
        }
        resolve(uploaded)
        return
      }

      const error = Object.assign(
        new Error(payload.error || 'Could not save photo'),
        {
          status: xhr.status,
          retryAfterMs: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined,
        },
      )
      reject(error)
    }

    xhr.onerror = () => reject(new TypeError('Network error'))
    xhr.ontimeout = () => reject(Object.assign(new Error('Upload timed out'), { status: 408 }))
    xhr.onabort = () =>
      reject(Object.assign(new DOMException('Aborted', 'AbortError'), { cancelled: true }))
    xhr.onloadend = () => {
      if (uploads.get(id) === xhr) uploads.delete(id)
    }

    const body = new FormData()
    body.append('photos', file)
    xhr.send(body)
  })
}

async function runItem(item: MemoryItem) {
  if (item.cancelled || inFlight.has(item.id)) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    emit({ type: 'status', id: item.id, status: 'retrying' })
    return
  }

  inFlight.add(item.id)
  emit({ type: 'status', id: item.id, status: 'uploading', progress: 0 })

  try {
    const photo = await uploadWithProgress(item.id, item.file, (progress) => {
      if (item.cancelled) return
      emit({ type: 'status', id: item.id, status: 'uploading', progress })
    })
    if (item.cancelled) return
    items.delete(item.id)
    await removePending(item.id)
    emit({ type: 'success', id: item.id, photo })
  } catch (error) {
    if (item.cancelled || (error as { cancelled?: boolean }).cancelled) return
    const status = (error as { status?: number }).status
    const retryable = isRetryableError(error, status)
    const message = error instanceof Error ? error.message : 'Could not save photo'
    item.attempts += 1
    item.lastError = message

    if (retryable && item.attempts < MAX_UPLOAD_ATTEMPTS) {
      const retryAfterMs = (error as { retryAfterMs?: number }).retryAfterMs
      item.nextRetryAt = Date.now() + (retryAfterMs ?? backoffMs(item.attempts))
      await persist(item)
      emit({ type: 'status', id: item.id, status: 'retrying' })
    } else {
      item.nextRetryAt = Number.POSITIVE_INFINITY
      await persist(item)
      emit({ type: 'error', id: item.id, message, retryable })
    }
  } finally {
    inFlight.delete(item.id)
    pump()
  }
}

function pump() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return

  const now = Date.now()
  const ready = [...items.values()]
    .filter(
      (item) =>
        !item.cancelled &&
        !inFlight.has(item.id) &&
        item.nextRetryAt <= now &&
        item.attempts < MAX_UPLOAD_ATTEMPTS,
    )
    .sort((a, b) => a.createdAt - b.createdAt)

  for (const item of ready) {
    if (inFlight.size >= MAX_CONCURRENT) break
    void runItem(item)
  }
}

function ensureScheduler() {
  if (schedulerStarted || typeof window === 'undefined') return
  schedulerStarted = true

  window.addEventListener('online', () => {
    emit({ type: 'online', online: true })
    for (const item of items.values()) {
      if (item.nextRetryAt === Number.POSITIVE_INFINITY) continue
      item.nextRetryAt = Math.min(item.nextRetryAt, Date.now())
    }
    pump()
  })
  window.addEventListener('offline', () => {
    emit({ type: 'online', online: false })
    for (const item of items.values()) {
      if (inFlight.has(item.id) || item.attempts >= MAX_UPLOAD_ATTEMPTS) continue
      emit({ type: 'status', id: item.id, status: 'retrying' })
    }
  })
  window.setInterval(() => pump(), SCHEDULER_MS)
}

export function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export async function restoreQueue() {
  if (restored) return
  if (restorePromise) return restorePromise

  restorePromise = (async () => {
    ensureScheduler()
    const records = await listPending()
    for (const record of records) {
      const item = remember(record)
      if (item.attempts >= MAX_UPLOAD_ATTEMPTS) {
        emit({
          type: 'error',
          id: item.id,
          message: item.lastError || 'Could not save photo',
          retryable: true,
        })
      } else {
        emit({
          type: 'status',
          id: item.id,
          status: item.attempts > 0 ? 'retrying' : 'queued',
        })
      }
    }
    restored = true
    pump()
  })()

  try {
    await restorePromise
  } finally {
    restorePromise = null
  }
}

export async function enqueue(id: string, file: File) {
  ensureScheduler()
  const item: MemoryItem = {
    id,
    file,
    createdAt: Date.now(),
    attempts: 0,
    nextRetryAt: 0,
    lastError: null,
    cancelled: false,
  }
  items.set(id, item)
  await persist(item)
  emit({ type: 'status', id, status: 'queued' })
  pump()
}

export async function retryNow(id: string) {
  const item = items.get(id)
  if (!item || item.cancelled) return
  item.attempts = 0
  item.nextRetryAt = 0
  item.lastError = null
  await persist(item)
  emit({ type: 'status', id, status: 'queued' })
  pump()
}

export async function cancel(id: string) {
  const item = items.get(id)
  if (item) {
    item.cancelled = true
    items.delete(id)
  }
  uploads.get(id)?.abort()
  uploads.delete(id)
  inFlight.delete(id)
  await removePending(id)
  pump()
}

export function pendingSnapshot() {
  return [...items.values()]
    .filter((item) => !item.cancelled)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((item) => ({
      id: item.id,
      file: item.file,
      createdAt: item.createdAt,
      attempts: item.attempts,
    }))
}
