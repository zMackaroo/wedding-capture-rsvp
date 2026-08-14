const apiBase = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export function apiUrl(path: string) {
  return `${apiBase}${path}`
}

export function mediaUrl(path: string) {
  if (path.startsWith('blob:') || /^https?:\/\//.test(path)) return path
  return apiUrl(path)
}
