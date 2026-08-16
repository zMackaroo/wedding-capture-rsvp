import { useEffect, useRef } from 'react'
import { InvitationPage } from './pages/InvitationPage'
import { UploadPage } from './pages/UploadPage'
import { usePhotos } from './hooks/usePhotos'
import './App.css'

function App() {
  const appRef = useRef<HTMLElement>(null)
  const { photos, addFiles, dismissPhoto, retryPhoto, albumState, albumError, queue, limitNotice } =
    usePhotos()

  useEffect(() => {
    const app = appRef.current
    const invitation = app?.querySelector('.invitation')
    if (!app || !(invitation instanceof HTMLElement)) return

    const onScroll = () => {
      app.classList.toggle(
        'is-free-scroll',
        app.scrollTop >= invitation.offsetHeight - 4,
      )
    }

    onScroll()
    app.addEventListener('scroll', onScroll, { passive: true })
    return () => app.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <main className="app" ref={appRef}>
      <InvitationPage />
      <UploadPage
        photos={photos}
        albumState={albumState}
        albumError={albumError}
        queue={queue}
        limitNotice={limitNotice}
        onAddFiles={addFiles}
        onDismiss={dismissPhoto}
        onRetry={retryPhoto}
      />
    </main>
  )
}

export default App
