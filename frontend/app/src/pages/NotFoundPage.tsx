import { Compass } from 'lucide-react'
import { BrandMark } from '@/components/brand/BrandMark'
import { LinkButton } from '@/components/ui/Button'
import { ROUTES } from '@/constants/routes'
import { useStudentContext } from '@/app/providers/StudentProvider'

export function NotFoundPage() {
  const { studentId } = useStudentContext()
  return (
    <div className="mx-auto flex min-h-[70svh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <BrandMark size={64} />
      <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-primary">404</p>
      <h1 className="text-3xl font-semibold">This page doesn&apos;t exist</h1>
      <p className="text-muted">The link may be mistyped or the page may have moved. Here is where you can go next.</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <LinkButton to={studentId ? ROUTES.dashboard : ROUTES.landing} icon={<Compass className="size-4" />}>
          {studentId ? 'Back to your dashboard' : 'Back to home'}
        </LinkButton>
        <LinkButton to={ROUTES.help} variant="secondary">Help</LinkButton>
      </div>
    </div>
  )
}
