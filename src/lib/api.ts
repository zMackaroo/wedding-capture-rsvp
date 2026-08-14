function apiBase() {
  const raw = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/$/, '')
  if (!raw) return ''
  if (/^https?:\/\//.test(raw)) return raw
  return `https://${raw}`
}

const base = apiBase()

export function apiUrl(path: string) {
  return `${base}${path}`
}

export function mediaUrl(path: string) {
  if (path.startsWith('blob:') || /^https?:\/\//.test(path)) return path
  return apiUrl(path)
}
