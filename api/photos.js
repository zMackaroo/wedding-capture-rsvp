import Busboy from 'busboy'
import {
  DriveConfigError,
  listPhotos,
  publicDriveError,
  uploadPhoto,
} from './lib/drive.js'

export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
}

function sendError(res, error, fallback) {
  console.error(error)
  const message = publicDriveError(error)
  res
    .status(error instanceof DriveConfigError ? 503 : 500)
    .json({ error: message || fallback })
}

function readPhotos(req) {
  return new Promise((resolve, reject) => {
    const files = []
    const busboy = Busboy({
      headers: req.headers,
      limits: { files: 8, fileSize: 4.5 * 1024 * 1024 },
    })

    busboy.on('file', (_name, file, info) => {
      const chunks = []
      file.on('data', (chunk) => chunks.push(chunk))
      file.on('limit', () =>
        reject(new Error('Each photo must be under 4.5MB')),
      )
      file.on('end', () => {
        files.push({
          buffer: Buffer.concat(chunks),
          originalname: info.filename || 'photo.jpg',
          mimetype: info.mimeType || 'image/jpeg',
        })
      })
    })
    busboy.on('error', reject)
    busboy.on('finish', () => resolve(files))
    req.pipe(busboy)
  })
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      res.status(200).json({ photos: await listPhotos() })
    } catch (error) {
      sendError(res, error, 'Could not load photos')
    }
    return
  }

  if (req.method === 'POST') {
    try {
      const files = await readPhotos(req)
      if (files.length === 0) {
        res.status(400).json({ error: 'Choose at least one photo' })
        return
      }
      const photos = []
      for (const file of files) {
        photos.push(await uploadPhoto(file))
      }
      res.status(201).json({ photos })
    } catch (error) {
      sendError(res, error, 'Could not save photo to Drive')
    }
    return
  }

  res.setHeader('Allow', 'GET, POST')
  res.status(405).json({ error: 'Method not allowed' })
}
