import { InvitationPage } from './pages/InvitationPage'
import { UploadPage } from './pages/UploadPage'
import { usePhotos } from './hooks/usePhotos'
import './App.css'

function App() {
  const { photos, addFiles, dismissPhoto, albumState, albumError } = usePhotos()

  return (
    <main className="app">
      <InvitationPage />
      <UploadPage
        photos={photos}
        albumState={albumState}
        albumError={albumError}
        onAddFiles={addFiles}
        onDismiss={dismissPhoto}
      />
    </main>
  )
}

export default App
