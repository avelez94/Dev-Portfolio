/** Admin API helpers: fetch that reports an ended session, and readable API errors. */
export const MY_EMAIL = 'alante@alantevelez.com'

/** Same as fetch, but tells the page when the admin session has ended (401). */
export async function adminFetch(input: string, init?: RequestInit) {
  const res = await fetch(input, init)
  if (res.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('admin-session-expired'))
  return res
}

/** Reads a JSON error from the document APIs, including the migration block. */
export async function apiError(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({}))
  return data?.message || data?.error || 'Something went wrong. Nothing was sent.'
}

export const postJson = (url: string, body: unknown) =>
  adminFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
