import { DriveConfigError, getPhotoStream, publicDriveError } from '../lib/drive.js'

export const config = {
  maxDuration: 60,
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const id = req.query.id
    const photo = await getPhotoStream(Array.isArray(id) ? id[0] : id)
    if (!photo) {
      res.status(404).json({ error: 'Photo not found' })
      return
    }
    res.setHeader('Content-Type', photo.mimeType)
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable')
    photo.stream.pipe(res)
  } catch (error) {
    console.error(error)
    const message = publicDriveError(error)
    res
      .status(error instanceof DriveConfigError ? 503 : 500)
      .json({ error: message || 'Could not load photo' })
  }
}
