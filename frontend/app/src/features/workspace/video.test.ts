import { describe, expect, it } from 'vitest'
import { youtubeEmbedUrl } from './video'

describe('youtubeEmbedUrl', () => {
  it('builds a privacy-enhanced embed from watch and short links', () => {
    expect(youtubeEmbedUrl('https://www.youtube.com/watch?v=YYXdXT2l-Gg')).toBe('https://www.youtube-nocookie.com/embed/YYXdXT2l-Gg')
    expect(youtubeEmbedUrl('https://youtu.be/khKv-8q7YmY')).toBe('https://www.youtube-nocookie.com/embed/khKv-8q7YmY')
  })
  it('rejects other hosts, missing ids and garbage', () => {
    expect(youtubeEmbedUrl('https://example.com/watch?v=abcdefg')).toBeNull()
    expect(youtubeEmbedUrl('https://www.youtube.com/watch')).toBeNull()
    expect(youtubeEmbedUrl('not a url')).toBeNull()
    expect(youtubeEmbedUrl('https://www.youtube.com/watch?v="><script>')).toBeNull()
  })
})
