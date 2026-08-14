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
      body.append('photos', item.file)

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
