import { Check, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useId } from 'react'
import { useKeyShortcuts } from '@/hooks/useKeyShortcuts'
import { cn } from '@/lib/cn'
import { RichText } from './RichText'

interface Props {
  question: string
  choices: string[]
  selected: number | null
  onSelect: (index: number) => void
  disabled?: boolean
  /** after grading: highlight the right answer and the student's wrong pick */
  reveal?: { correctIndex: number }
  /** enable the 1-4 keys (off when another handler owns the keyboard) */
  shortcuts?: boolean
}

/** A single multiple-choice question with radio-group semantics. Shared by the placement quiz and
 *  the Learning Workspace. Correct / wrong are conveyed with an icon and text, not colour alone. */
export function McqQuestion({ question, choices, selected, onSelect, disabled, reveal, shortcuts = true }: Props) {
  const labelId = useId()
  useKeyShortcuts(
    Object.fromEntries(choices.map((_, i) => [String(i + 1), () => !disabled && onSelect(i)])),
    shortcuts && !reveal,
  )
  return (
    <div>
      <div id={labelId} className="rounded-lg border border-border bg-raised/60 p-4 text-[15px] font-medium leading-relaxed">
        <RichText text={question} />
      </div>
      <div role="radiogroup" aria-labelledby={labelId} className="mt-4 space-y-2.5">
        {choices.map((choice, i) => {
          const isSelected = selected === i
          const isCorrect = reveal?.correctIndex === i
          const isWrongPick = !!reveal && isSelected && !isCorrect
          return (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] }}
              whileTap={disabled || reveal ? undefined : { scale: 0.985 }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled || !!reveal}
              onClick={() => onSelect(i)}
              className={cn(
                'flex w-full items-start gap-3 rounded-lg border p-3.5 text-left text-[15px] transition-[background-color,border-color,box-shadow,opacity] duration-200',
                !reveal && (isSelected ? 'border-primary bg-primary-soft ring-1 ring-primary' : 'border-border bg-surface hover:border-border-strong hover:bg-raised'),
                isCorrect && 'border-good bg-good-soft',
                isWrongPick && 'border-bad bg-bad-soft',
                reveal && !isCorrect && !isWrongPick && 'border-border bg-surface opacity-70',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border text-xs font-semibold transition-colors',
                  (isSelected || isCorrect || isWrongPick) && 'nt-pop',
                  isSelected && !reveal ? 'border-primary bg-primary text-on-primary' : 'border-border-strong text-muted',
                  isCorrect && 'border-good bg-good text-white',
                  isWrongPick && 'border-bad bg-bad text-white',
                )}
              >
                {isCorrect ? <Check className="size-3.5" aria-hidden /> : isWrongPick ? <X className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <RichText text={choice} className="space-y-1.5" />
                {isCorrect && <span className="mt-1 block text-xs font-semibold text-good">Correct answer</span>}
                {isWrongPick && <span className="mt-1 block text-xs font-semibold text-bad">Your answer</span>}
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
