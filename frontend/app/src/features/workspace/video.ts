/** https://www.youtube.com/watch?v=ID -> privacy-enhanced embed URL, or null when it is not a YouTube watch link. */
export function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    let id: string | null = null
    if (host === 'youtube.com' || host === 'm.youtube.com') id = u.searchParams.get('v')
    else if (host === 'youtu.be') id = u.pathname.slice(1) || null
    return id && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null
  } catch {
    return null
  }
}
