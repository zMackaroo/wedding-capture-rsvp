import Busboy from 'busboy'
import {
  DriveConfigError,
  listPhotos,
  publicDriveError,
  uploadPhoto,
} from './lib/drive.js'
import { UploadBusyError, withUploadLock } from './lib/uploadLock.js'
import { isAllowedMedia, mediaKind, validateUploadBatch } from './lib/media.js'

export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
}

function sendError(res, error, fallback) {
  console.error(error)
  if (error instanceof UploadBusyError || error?.status === 429) {
    res.setHeader('Retry-After', '5')
    res.status(429).json({ error: error.message || fallback })
    return
  }
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
      limits: { files: 11, fileSize: 25 * 1024 * 1024 },
    })

    busboy.on('file', (_name, file, info) => {
      const chunks = []
      file.on('data', (chunk) => chunks.push(chunk))
      file.on('limit', () =>
        reject(
          new Error(
            mediaKind(info.mimeType, info.filename) === 'video'
              ? 'Videos must be under 25MB'
              : 'Each photo must be under 25MB',
          ),
        ),
      )
      file.on('end', () => {
        const originalname = info.filename || 'upload'
        const mimetype = info.mimeType || ''
        if (!isAllowedMedia(mimetype, originalname)) {
          reject(new Error('Only photos and videos can be uploaded'))
          return
        }
        files.push({
          buffer: Buffer.concat(chunks),
          originalname,
          mimetype,
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
      res.setHeader('Cache-Control', 'no-store')
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
        res.status(400).json({ error: 'Choose at least one photo or video' })
        return
      }
      const invalid = validateUploadBatch(files)
      if (invalid) {
        res.status(400).json({ error: invalid })
        return
      }
      const photos = []
      for (const file of files) {
        photos.push(await withUploadLock(() => uploadPhoto(file)))
      }
      res.status(201).json({ photos })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (
        message.includes('25MB') ||
        message.includes('Only photos') ||
        message.includes('up to 10') ||
        message.includes('only 1 video')
      ) {
        res.status(400).json({ error: message })
        return
      }
      sendError(res, error, 'Could not save photo to Drive')
    }
    return
  }

  res.setHeader('Allow', 'GET, POST')
  res.status(405).json({ error: 'Method not allowed' })
}
