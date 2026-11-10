import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

const CODE_LINE = /^\s{2,}\S|^\s*(def |class |for |while |if |elif |else:|try:|except|return |import |from \S+ import |print\(|[A-Za-z_][\w.]*\s*(=|\+=|-=)\s*\S|[A-Za-z_][\w.]*\(.*\)\s*$|#)/

/** A paragraph counts as code only when it is clearly multi-line code, or one line that looks like a statement.
 *  Anything ambiguous stays prose. */
export function looksLikeCode(paragraph: string): boolean {
  const lines = paragraph.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length === 0) return false
  const codeish = lines.filter((l) => CODE_LINE.test(l)).length
  if (lines.length === 1) return codeish === 1 && !/[.?!:]\s*$/.test(lines[0]!.trim()) && !/^[A-Z][a-z]+ [a-z]+ [a-z]+/.test(lines[0]!.trim())
  return codeish / lines.length >= 0.6
}

function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith('`') && part.endsWith('`') && part.length > 2 ? (
      <code key={i} className="rounded bg-raised px-1.5 py-0.5 font-mono text-[0.9em]">
        {part.slice(1, -1)}
      </code>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

/** Renders question and choice text from the backend: prose with `inline code`, and clearly-code
 *  paragraphs as monospaced blocks. Plain text only -- React escapes everything. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const paragraphs = text.split(/\n{2,}/)
  return (
    <div className={cn('space-y-3', className)}>
      {paragraphs.map((p, i) =>
        looksLikeCode(p) ? (
          <pre key={i} className="overflow-x-auto rounded-md border border-border bg-raised p-3 font-mono text-[13px] leading-relaxed">
            <code>{p}</code>
          </pre>
        ) : (
          <p key={i} className="whitespace-pre-wrap">
            {inline(p)}
          </p>
        ),
      )}
    </div>
  )
}
