import { useEffect, useRef, useState } from 'react'
import type { Photo } from '../hooks/usePhotos'

type PhotoCardProps = {
  photo: Photo
  onDismiss: (id: string) => void
  onRetry: (id: string) => void
  onOpen: (photo: Photo) => void
}

function statusLabel(photo: Photo) {
  if (photo.status === 'queued') return 'Waiting'
  if (photo.status === 'retrying') return 'Waiting to retry'
  if (photo.status === 'error') return photo.error || 'Could not save'
  if (photo.status === 'uploading') {
    return typeof photo.progress === 'number' && photo.progress > 0
      ? `Saving ${photo.progress}%`
      : 'Saving'
  }
  return null
}

export function PhotoCard({ photo, onDismiss, onRetry, onOpen }: PhotoCardProps) {
  const cardRef = useRef<HTMLLIElement>(null)
  const [inView, setInView] = useState(false)
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const loaded = loadedUrl === photo.url
  const label = statusLabel(photo)
  const pending = photo.status !== 'ready'
  const showSkeleton = !loaded || pending

  useEffect(() => {
    const node = cardRef.current
    if (!node || inView) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '160px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [inView])

  return (
    <li
      ref={cardRef}
      className={`photo-card${pending ? ` is-${photo.status}` : ''}${loaded ? ' is-loaded' : ''}`}
      aria-busy={pending || !loaded}
    >
      <div
        className={`photo-skeleton${showSkeleton ? ' is-visible' : ''}`}
        aria-hidden={!showSkeleton}
      />
      {inView && photo.kind === 'video' ? (
        <video
          src={photo.url}
          muted
          playsInline
          preload="metadata"
          onLoadedData={() => setLoadedUrl(photo.url)}
        />
      ) : inView ? (
        <img
          src={photo.url}
          alt="Uploaded wedding photo"
          loading="lazy"
          decoding="async"
          onLoad={() => setLoadedUrl(photo.url)}
        />
      ) : null}
      {photo.kind === 'video' && loaded ? (
        <span className="photo-play" aria-hidden="true">
          <PlayIcon />
        </span>
      ) : null}
      {photo.status === 'ready' && inView ? (
        <button
          type="button"
          className="photo-open"
          onClick={() => onOpen(photo)}
          aria-label={photo.kind === 'video' ? 'Play video' : 'View photo'}
        />
      ) : null}
      {photo.status === 'uploading' ? (
        <span
          className={`photo-progress${photo.progress ? '' : ' is-indeterminate'}`}
          style={
            photo.progress
              ? { transform: `scaleX(${photo.progress / 100})` }
              : undefined
          }
        />
      ) : null}
      {label ? <p className="photo-status">{label}</p> : null}
      {photo.status === 'error' ? (
        <>
          <button
            type="button"
            className="photo-retry"
            onClick={() => onRetry(photo.id)}
          >
            Retry
          </button>
          <button
            type="button"
            className="photo-remove"
            onClick={() => onDismiss(photo.id)}
            aria-label="Dismiss failed photo"
          >
            <CloseIcon />
          </button>
        </>
      ) : null}
    </li>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9.25" fill="rgb(22 22 22 / 0.55)" />
      <path d="M10 8.8 16.2 12 10 15.2Z" fill="#f4f2ef" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 7l10 10M17 7 7 17"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
