import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiUrl, mediaUrl } from '../lib/api'
import { kindFromMime, selectUploadBatch, type MediaKind } from '../lib/media'
import {
  cancel,
  enqueue,
  MAX_UPLOAD_ATTEMPTS,
  pendingSnapshot,
  restoreQueue,
  retryNow,
  subscribe,
  type ApiPhoto,
} from '../lib/uploadQueue'

export type PhotoStatus = 'queued' | 'uploading' | 'retrying' | 'ready' | 'error'

export type Photo = {
  id: string
  url: string
  kind: MediaKind
  status: PhotoStatus
  progress?: number
  error?: string
}

export type QueueSummary = {
  pending: number
  uploading: number
  queued: number
  retrying: number
  online: boolean
}

type AlbumState = 'loading' | 'ready' | 'error'

const POLL_MS = 12_000

async function compressImage(file: File) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const max = 1920
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82),
    )
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
      type: 'image/jpeg',
    })
  } catch {
    return file
  }
}

async function readApiError(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { error?: string }
    return data.error || fallback
  } catch {
    return fallback
  }
}

function mergeRemote(local: Photo[], remote: ApiPhoto[]): Photo[] {
  const inflight = local.filter((photo) => photo.status !== 'ready')
  const inflightIds = new Set(inflight.map((photo) => photo.id))
  const remoteReady = remote
    .filter((photo) => !inflightIds.has(photo.id))
    .map((photo) => ({
      id: photo.id,
      url: mediaUrl(photo.url),
      kind: photo.kind ?? kindFromMime(photo.mimeType),
      status: 'ready' as const,
    }))
  return [...inflight, ...remoteReady]
}

export function usePhotos() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [albumState, setAlbumState] = useState<AlbumState>('loading')
  const [albumError, setAlbumError] = useState<string | null>(null)
  const [online, setOnline] = useState(
    () => (typeof navigator === 'undefined' ? true : navigator.onLine),
  )
  const [limitNotice, setLimitNotice] = useState<string | null>(null)
  const didLoad = useRef(false)

  const refreshAlbum = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(apiUrl('/api/photos'), {
        signal,
        cache: 'no-store',
      })
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Could not load the album'))
      }
      const data = (await response.json()) as { photos: ApiPhoto[] }
      didLoad.current = true
      setPhotos((current) => mergeRemote(current, data.photos))
      setAlbumError(null)
      setAlbumState('ready')
    } catch (error: unknown) {
      if (signal?.aborted) return
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (didLoad.current) return
      setAlbumState('error')
      setAlbumError(
        error instanceof Error ? error.message : 'Could not load the album',
      )
    }
  }, [])

  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      if (event.type === 'online') {
        setOnline(event.online)
        return
      }

      if (event.type === 'status') {
        setPhotos((current) =>
          current.map((photo) =>
            photo.id === event.id
              ? {
                  ...photo,
                  status: event.status,
                  progress: event.progress ?? photo.progress,
                  error: undefined,
                }
              : photo,
          ),
        )
        return
      }

      if (event.type === 'error') {
        setPhotos((current) =>
          current.map((photo) =>
            photo.id === event.id
              ? { ...photo, status: 'error', error: event.message }
              : photo,
          ),
        )
        return
      }

      setPhotos((current) => {
        const match = current.find((photo) => photo.id === event.id)
        if (match?.url.startsWith('blob:')) URL.revokeObjectURL(match.url)
        return current.flatMap((photo) => {
          if (photo.id === event.photo.id) return []
          if (photo.id !== event.id) return [photo]
          return [
            {
              id: event.photo.id,
              url: mediaUrl(event.photo.url),
              kind: event.photo.kind ?? kindFromMime(event.photo.mimeType),
              status: 'ready' as const,
            },
          ]
        })
      })
    })

    let cancelled = false
    const controller = new AbortController()

    void (async () => {
      await restoreQueue()
      if (cancelled) return

      const pending = pendingSnapshot()
      if (pending.length > 0) {
        setPhotos((current) => {
          const byId = new Map(current.map((photo) => [photo.id, photo]))
          const pendingPhotos = pending.map((item) => {
            const existing = byId.get(item.id)
            if (existing) return existing
            return {
              id: item.id,
              url: URL.createObjectURL(item.file),
              kind: kindFromMime(item.file.type, item.file.name),
              status: (item.attempts >= MAX_UPLOAD_ATTEMPTS
                ? 'error'
                : item.attempts > 0
                  ? 'retrying'
                  : 'queued') as PhotoStatus,
            }
          })
          const pendingIds = new Set(pending.map((item) => item.id))
          return [...pendingPhotos, ...current.filter((photo) => !pendingIds.has(photo.id))]
        })
        setAlbumState('ready')
      }

      await refreshAlbum(controller.signal)
    })()

    const poll = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void refreshAlbum()
    }, POLL_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshAlbum()
    }

    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      controller.abort()
      unsubscribe()
      window.clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refreshAlbum])

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const { accepted, notice } = selectUploadBatch(Array.from(fileList))
    setLimitNotice(notice)
    if (accepted.length === 0) return
    setAlbumState('ready')

    for (const file of accepted) {
      const readyFile = file.type.startsWith('video/') ? file : await compressImage(file)
      const id = crypto.randomUUID()
      const url = URL.createObjectURL(readyFile)
      setPhotos((current) => [
        {
          id,
          url,
          kind: kindFromMime(readyFile.type, readyFile.name),
          status: 'queued',
        },
        ...current,
      ])
      void enqueue(id, readyFile)
    }
  }, [])

  const dismissPhoto = useCallback((id: string) => {
    setPhotos((current) => {
      const match = current.find((photo) => photo.id === id)
      if (match?.url.startsWith('blob:')) URL.revokeObjectURL(match.url)
      return current.filter((photo) => photo.id !== id)
    })
    void cancel(id)
  }, [])

  const retryPhoto = useCallback((id: string) => {
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === id
          ? { ...photo, status: 'queued', progress: 0, error: undefined }
          : photo,
      ),
    )
    void retryNow(id)
  }, [])

  const queue = useMemo<QueueSummary>(() => {
    const pendingPhotos = photos.filter((photo) => photo.status !== 'ready')
    return {
      pending: pendingPhotos.length,
      uploading: pendingPhotos.filter((photo) => photo.status === 'uploading').length,
      queued: pendingPhotos.filter((photo) => photo.status === 'queued').length,
      retrying: pendingPhotos.filter((photo) => photo.status === 'retrying').length,
      online,
    }
  }, [photos, online])

  return {
    photos,
    addFiles,
    dismissPhoto,
    retryPhoto,
    albumState,
    albumError,
    queue,
    limitNotice,
  }
}
