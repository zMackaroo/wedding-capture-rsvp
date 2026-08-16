const BLOCKED_IMAGE = new Set([
  'image/svg+xml',
  'image/svg',
  'image/x-icon',
  'image/vnd.microsoft.icon',
])

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp)$/i
const VIDEO_EXT = /\.(mp4|mov|webm|m4v|3gp|mpeg|mpg)$/i

export function mediaKind(mimeType = '', name = '') {
  const type = mimeType.toLowerCase().split(';')[0].trim()
  if (type.startsWith('video/')) return 'video'
  if (type.startsWith('image/') && !BLOCKED_IMAGE.has(type)) return 'image'
  if (VIDEO_EXT.test(name)) return 'video'
  if (IMAGE_EXT.test(name)) return 'image'
  return null
}

export function isAllowedMedia(mimeType, name) {
  return mediaKind(mimeType, name) !== null
}

export const MAX_PHOTOS_PER_UPLOAD = 10
export const MAX_VIDEOS_PER_UPLOAD = 1
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024

export function validateUploadBatch(files) {
  let photos = 0
  let videos = 0

  for (const file of files) {
    const kind = mediaKind(file.mimetype || file.type, file.originalname || file.name)
    const size = file.size ?? file.buffer?.length ?? 0

    if (kind === 'video') {
      if (size >= MAX_VIDEO_BYTES) return 'Videos must be under 25MB'
      videos += 1
      if (videos > MAX_VIDEOS_PER_UPLOAD) {
        return 'Each upload can include only 1 video'
      }
      continue
    }

    if (kind !== 'image') return 'Only photos and videos can be uploaded'
    photos += 1
    if (photos > MAX_PHOTOS_PER_UPLOAD) {
      return 'Each upload can include up to 10 photos'
    }
  }

  return null
}
