const DB_NAME = 'capture-album'
const STORE = 'pending-uploads'
const VERSION = 1

export type PendingUpload = {
  id: string
  name: string
  type: string
  blob: Blob
  createdAt: number
  attempts: number
  nextRetryAt: number
  lastError: string | null
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function savePending(record: PendingUpload): Promise<void> {
  const db = await openDb()
  if (!db) return
  try {
    await requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).put(record))
  } catch {
    // Quota or private-mode failures should not block the in-memory queue.
  } finally {
    db.close()
  }
}

export async function getPending(id: string): Promise<PendingUpload | undefined> {
  const db = await openDb()
  if (!db) return undefined
  try {
    return (await requestToPromise(
      db.transaction(STORE, 'readonly').objectStore(STORE).get(id),
    )) as PendingUpload | undefined
  } catch {
    return undefined
  } finally {
    db.close()
  }
}

export async function listPending(): Promise<PendingUpload[]> {
  const db = await openDb()
  if (!db) return []
  try {
    const records = await requestToPromise(
      db.transaction(STORE, 'readonly').objectStore(STORE).getAll(),
    )
    return Array.isArray(records)
      ? records.sort((a, b) => a.createdAt - b.createdAt)
      : []
  } catch {
    return []
  } finally {
    db.close()
  }
}

export async function removePending(id: string): Promise<void> {
  const db = await openDb()
  if (!db) return
  try {
    await requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id))
  } catch {
    // Ignore persistence failures on dismiss/success.
  } finally {
    db.close()
  }
}

export function fileFromPending(record: PendingUpload): File {
  return new File([record.blob], record.name, { type: record.type })
}
