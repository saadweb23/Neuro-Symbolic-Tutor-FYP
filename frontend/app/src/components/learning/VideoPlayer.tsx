import { ExternalLink } from 'lucide-react'
import { youtubeEmbedUrl } from '@/features/workspace/video'

export function VideoPlayer({ title, url, source }: { title: string; url: string; source: string }) {
  const embed = youtubeEmbedUrl(url)
  return embed ? (
    <div className="relative w-full overflow-hidden rounded-lg bg-black pb-[56.25%]">
      <iframe
        src={embed}
        title={title}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; encrypted-media; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 size-full"
      />
    </div>
  ) : (
    <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-2 font-medium text-primary underline-offset-2 hover:underline">
      Watch on {source} <ExternalLink className="size-4" aria-hidden />
    </a>
  )
}
