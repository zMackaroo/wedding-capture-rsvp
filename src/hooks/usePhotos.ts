import { useCallback, useEffect, useState } from 'react'
import { apiUrl, mediaUrl } from '../lib/api'

export type Photo = {
  id: string
  url: string
  status: 'uploading' | 'ready' | 'error'
}

type AlbumState = 'loading' | 'ready' | 'error'

type ApiPhoto = {
  id: string
  url: string
}

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

export function usePhotos() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [albumState, setAlbumState] = useState<AlbumState>('loading')
  const [albumError, setAlbumError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch(apiUrl('/api/photos'))
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await readApiError(response, 'Could not load the album'))
        }
        return response.json() as Promise<{ photos: ApiPhoto[] }>
      })
      .then((data) => {
        if (cancelled) return
        setPhotos(
          data.photos.map((photo) => ({
            id: photo.id,
            url: mediaUrl(photo.url),
            status: 'ready',
          })),
        )
        setAlbumError(null)
        setAlbumState('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setAlbumState('error')
        setAlbumError(
          error instanceof Error ? error.message : 'Could not load the album',
        )
      })

    return () => {
      cancelled = true
    }
  }, [])

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((file) =>
      file.type.startsWith('image/'),
    )
    if (files.length === 0) return

    const pending = files.map((file) => {
      const url = URL.createObjectURL(file)
      return {
        id: crypto.randomUUID(),
        url,
        status: 'uploading' as const,
        file,
      }
    })

    setPhotos((current) => [
      ...pending.map(({ id, url, status }) => ({ id, url, status })),
      ...current,
    ])
    setAlbumState('ready')

    for (const item of pending) {
      const body = new FormData()
      body.append('photos', await compressImage(item.file))

      try {
        const response = await fetch(apiUrl('/api/photos'), {
          method: 'POST',
          body,
        })
        if (!response.ok) {
          throw new Error(await readApiError(response, 'Could not save photo'))
        }
        const data = (await response.json()) as { photos: ApiPhoto[] }
        const uploaded = data.photos[0]
        if (!uploaded) throw new Error('Could not save photo')

        URL.revokeObjectURL(item.url)
        setPhotos((current) =>
          current.map((photo) =>
            photo.id === item.id
              ? { id: uploaded.id, url: mediaUrl(uploaded.url), status: 'ready' }
              : photo,
          ),
        )
      } catch {
        setPhotos((current) =>
          current.map((photo) =>
            photo.id === item.id ? { ...photo, status: 'error' } : photo,
          ),
        )
      }
    }
  }, [])

  const dismissPhoto = useCallback((id: string) => {
    setPhotos((current) => {
      const match = current.find((photo) => photo.id === id)
      if (match?.url.startsWith('blob:')) URL.revokeObjectURL(match.url)
      return current.filter((photo) => photo.id !== id)
    })
  }, [])

  return { photos, addFiles, dismissPhoto, albumState, albumError }
}
