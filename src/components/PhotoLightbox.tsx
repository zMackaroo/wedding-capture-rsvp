import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Photo } from '../hooks/usePhotos'

type PhotoLightboxProps = {
  photo: Photo
  onClose: () => void
}

export function PhotoLightbox({ photo, onClose }: PhotoLightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const app = document.querySelector('.app')
    const previousBody = document.body.style.overflow
    const previousApp = app instanceof HTMLElement ? app.style.overflow : ''
    document.body.style.overflow = 'hidden'
    if (app instanceof HTMLElement) app.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = previousBody
      if (app instanceof HTMLElement) app.style.overflow = previousApp
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={photo.kind === 'video' ? 'Video' : 'Photograph'}
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        className="lightbox-close"
        onClick={onClose}
        aria-label={photo.kind === 'video' ? 'Close video' : 'Close photo'}
      >
        <CloseIcon />
      </button>
      {photo.kind === 'video' ? (
        <video
          className="lightbox-image"
          src={photo.url}
          controls
          playsInline
          autoPlay
          onClick={(event) => event.stopPropagation()}
        />
      ) : (
        <img
          className="lightbox-image"
          src={photo.url}
          alt="Wedding photo"
          onClick={(event) => event.stopPropagation()}
        />
      )}
    </div>,
    document.body,
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
