import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { PhotoCard } from "../components/PhotoCard";
import { PhotoLightbox } from "../components/PhotoLightbox";
import type { Photo, QueueSummary } from "../hooks/usePhotos";

type UploadPageProps = {
  photos: Photo[];
  albumState: "loading" | "ready" | "error";
  albumError: string | null;
  queue: QueueSummary;
  limitNotice: string | null;
  onAddFiles: (files: FileList | File[]) => void;
  onDismiss: (id: string) => void;
  onRetry: (id: string) => void;
};

function queueCopy(queue: QueueSummary) {
  if (queue.pending === 0) return null;
  const count = queue.pending;
  const noun = count === 1 ? "photo" : "photos";
  if (!queue.online) {
    return `You're offline. ${count} ${noun} will save when you're back.`;
  }
  if (queue.retrying > 0) {
    return `Waiting to retry ${queue.retrying} ${queue.retrying === 1 ? "photo" : "photos"}…`;
  }
  if (queue.uploading > 0) {
    return `Saving ${queue.uploading} of ${count}…`;
  }
  return `${count} ${noun} waiting to save`;
}

export function UploadPage({
  photos,
  albumState,
  albumError,
  queue,
  limitNotice,
  onAddFiles,
  onDismiss,
  onRetry,
}: UploadPageProps) {
  const libraryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [viewer, setViewer] = useState<Photo | null>(null);
  const note = queueCopy(queue);
  const closeViewer = useCallback(() => setViewer(null), []);

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) onAddFiles(event.target.files);
    event.target.value = "";
  };

  const onDragOver = (event: DragEvent) => {
    event.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length) onAddFiles(event.dataTransfer.files);
  };

  return (
    <section className="page album" id="album" aria-label="Photo album">
      <header className="album-header">
        <p className="album-kicker">Christian and Franhess</p>
        <h2 className="album-title">Our Album</h2>
        <p className="album-lede">Share photos and videos from the day</p>
      </header>

      <div className="album-body">
        <div
          className={`dropzone${dragging ? " is-dragging" : ""}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <input
            ref={libraryRef}
            className="sr-only"
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFiles}
          />
          <input
            ref={cameraRef}
            className="sr-only"
            type="file"
            accept="image/*,video/*"
            capture="environment"
            onChange={handleFiles}
          />

          <p className="dropzone-script">Add a photo or video</p>
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

        {limitNotice ? (
          <p className="queue-note" role="status">
            {limitNotice}
          </p>
        ) : null}
        {note ? (
          <p className="queue-note" aria-live="polite">
            {note}
          </p>
        ) : null}

        {photos.length > 0 ? (
          <ul
            className="photo-grid"
            aria-label={`${photos.length} uploaded photos`}
          >
            {photos.map((photo) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                onDismiss={onDismiss}
                onRetry={onRetry}
                onOpen={setViewer}
              />
            ))}
          </ul>
        ) : albumState === "loading" ? (
          <ul
            className="photo-grid"
            aria-busy="true"
            aria-label="Loading photographs"
          >
            {Array.from({ length: 4 }, (_, index) => (
              <li key={index} className="photo-card is-skeleton">
                <div className="photo-skeleton is-visible" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-copy">
            {albumState === "error"
              ? albumError || "Could not load the album."
              : "No photographs yet."}
          </p>
        )}
      </div>

      {viewer ? <PhotoLightbox photo={viewer} onClose={closeViewer} /> : null}
    </section>
  );
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
  );
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
  );
}
