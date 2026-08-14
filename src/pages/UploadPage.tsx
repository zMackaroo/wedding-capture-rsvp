import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import type { Photo } from '../hooks/usePhotos'

type UploadPageProps = {
  photos: Photo[]
  albumState: 'loading' | 'ready' | 'error'
  albumError: string | null
  onAddFiles: (files: FileList | File[]) => void
  onDismiss: (id: string) => void
}

export function UploadPage({
  photos,
  albumState,
  albumError,
  onAddFiles,
  onDismiss,
}: UploadPageProps) {
  const libraryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) onAddFiles(event.target.files)
    event.target.value = ''
  }

  const onDragOver = (event: DragEvent) => {
    event.preventDefault()
    setDragging(true)
  }

  const onDragLeave = () => setDragging(false)

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files.length) onAddFiles(event.dataTransfer.files)
  }

  return (
    <section className="page album" id="album" aria-label="Photo album">
      <header className="album-header">
        <p className="album-kicker">Christian and Franhess</p>
        <h2 className="album-title">Our Album</h2>
        <p className="album-lede">Share your photos from the day</p>
      </header>

      <div className="album-body">
        <div
          className={`dropzone${dragging ? ' is-dragging' : ''}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <input
            ref={libraryRef}
            className="sr-only"
            type="file"
            accept="image/*"
            multiple
            onChange={handleFiles}
          />
          <input
            ref={cameraRef}
            className="sr-only"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFiles}
          />

          <p className="dropzone-script">Add a photo</p>
          <p className="dropzone-hint">From your camera or library</p>

          <div className="dropzone-actions">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => cameraRef.current?.click()}
            >
              <CameraIcon />
              Camera
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => libraryRef.current?.click()}
            >
              <LibraryIcon />
              Library
            </button>
          </div>
        </div>

        {photos.length > 0 ? (
          <ul className="photo-grid" aria-label={`${photos.length} uploaded photos`}>
            {photos.map((photo) => (
              <li
                key={photo.id}
                className={`photo-card${photo.status !== 'ready' ? ` is-${photo.status}` : ''}`}
              >
                <img src={photo.url} alt="Uploaded wedding photo" />
                {photo.status === 'uploading' ? (
                  <p className="photo-status">Saving</p>
                ) : null}
                {photo.status === 'error' ? (
                  <>
                    <p className="photo-status">Could not save</p>
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
            ))}
          </ul>
        ) : (
          <p className="empty-copy">
            {albumState === 'loading'
              ? 'Loading photographs…'
              : albumState === 'error'
                ? albumError || 'Could not load the album.'
                : 'No photographs yet.'}
          </p>
        )}
      </div>
    </section>
  )
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4.5 8.5h3l1.2-2h6.6l1.2 2h3A1.5 1.5 0 0 1 21 10v8.5A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5V10A1.5 1.5 0 0 1 4.5 8.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <circle
        cx="12"
        cy="14"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </svg>
  )
}

function LibraryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="3.5"
        y="5.5"
        width="17"
        height="13"
        rx="1.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path
        d="M3.5 16.5 8 12l3.5 3.5 3-3 6 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="9.5" r="1.15" fill="currentColor" />
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
