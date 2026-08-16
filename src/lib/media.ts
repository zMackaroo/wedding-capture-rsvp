const BLOCKED_IMAGE = new Set([
  'image/svg+xml',
  'image/svg',
  'image/x-icon',
  'image/vnd.microsoft.icon',
])

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp)$/i
const VIDEO_EXT = /\.(mp4|mov|webm|m4v|3gp|mpeg|mpg)$/i

export type MediaKind = 'image' | 'video'

export const MAX_PHOTOS_PER_UPLOAD = 10
export const MAX_VIDEOS_PER_UPLOAD = 1
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024

export function mediaKind(mimeType = '', name = ''): MediaKind | null {
  const type = mimeType.toLowerCase().split(';')[0].trim()
  if (type.startsWith('video/')) return 'video'
  if (type.startsWith('image/') && !BLOCKED_IMAGE.has(type)) return 'image'
  if (VIDEO_EXT.test(name)) return 'video'
  if (IMAGE_EXT.test(name)) return 'image'
  return null
}

export function isAllowedMedia(file: { type?: string; name?: string }) {
  return mediaKind(file.type, file.name) !== null
}

export function kindFromMime(mimeType?: string, name?: string): MediaKind {
  return mediaKind(mimeType, name) ?? 'image'
}

export function selectUploadBatch(files: File[]) {
  const photos: File[] = []
  const videos: File[] = []
  let extraPhotos = false
  let extraVideos = false
  let oversizedVideo = false

  for (const file of files) {
    const kind = mediaKind(file.type, file.name)
    if (kind === 'video') {
      if (file.size >= MAX_VIDEO_BYTES) {
        oversizedVideo = true
        continue
      }
      if (videos.length >= MAX_VIDEOS_PER_UPLOAD) {
        extraVideos = true
        continue
      }
      videos.push(file)
      continue
    }
    if (kind !== 'image') continue
    if (photos.length >= MAX_PHOTOS_PER_UPLOAD) {
      extraPhotos = true
      continue
    }
    photos.push(file)
  }

  const limited = extraPhotos || extraVideos || oversizedVideo
  let notice: string | null = null
  if (oversizedVideo && photos.length === 0 && videos.length === 0) {
    notice = 'Videos must be under 25MB. You can add up to 10 photos and 1 video per upload.'
  } else if (limited) {
    notice = 'Each upload can include up to 10 photos and 1 video under 25MB.'
  } else if (files.length > 0 && photos.length + videos.length === 0) {
    notice = 'Only photos and videos can be uploaded.'
  }

  return { accepted: [...photos, ...videos], notice }
}
