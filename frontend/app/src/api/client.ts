import { API_BASE } from '@/config/env'

export type ApiErrorKind = 'network' | 'http' | 'validation'

/** Every failure the UI can see, normalised. FastAPI returns `detail` as a string for handled
 *  errors but as an ARRAY of {loc, msg} objects for 422 validation errors; both become a
 *  readable `message` here so no component has to know. */
export class ApiError extends Error {
  readonly status: number
  readonly kind: ApiErrorKind
  readonly detail: unknown

  constructor(message: string, status: number, kind: ApiErrorKind, detail?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.kind = kind
    this.detail = detail
  }
}

interface ValidationItem {
  loc?: unknown[]
  msg?: string
}

export function describeDetail(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const parts = (detail as ValidationItem[])
      .map((d) => {
        const where = Array.isArray(d.loc) ? d.loc.filter((l) => l !== 'body' && l !== 'query' && l !== 'path').join('.') : ''
        return where ? `${where}: ${d.msg ?? 'invalid'}` : (d.msg ?? 'invalid')
      })
      .filter(Boolean)
    if (parts.length) return parts.join('; ')
  }
  return fallback
}

export async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      credentials: 'include',
    })
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') throw err
    throw new ApiError(
      'Cannot reach the NeuroTutor server. Check that the backend is running and try again.',
      0,
      'network',
    )
  }

  if (!res.ok) {
    // A 401 on a data route means the session ended (expired / signed out elsewhere): tell the app once.
    if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('neurotutor:unauthorized'))
    let detail: unknown
    try {
      detail = ((await res.json()) as { detail?: unknown }).detail
    } catch {
      /* no JSON body */
    }
    const fallback = res.statusText || `Request failed (${res.status})`
    throw new ApiError(describeDetail(detail, fallback), res.status, res.status === 422 ? 'validation' : 'http', detail)
  }
  return (await res.json()) as T
}

export const get = <T>(path: string, signal?: AbortSignal) => request<T>('GET', path, undefined, signal)
export const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {})

export const studentPath = (id: string, suffix: string) => `/students/${encodeURIComponent(id)}${suffix}`
