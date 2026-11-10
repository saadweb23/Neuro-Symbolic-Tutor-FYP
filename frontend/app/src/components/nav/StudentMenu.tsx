import { ChevronDown, LifeBuoy, LogOut, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStudentContext } from '@/app/providers/StudentProvider'
import { ROUTES } from '@/constants/routes'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'

export function StudentMenu() {
  const { studentId, clearStudent } = useStudentContext()
  const navigate = useNavigate()
  if (!studentId) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-10 items-center gap-2 rounded-md pl-1.5 pr-2 transition-colors hover:bg-raised"
      >
        <span aria-hidden className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold uppercase text-on-primary">
          {studentId.slice(0, 1)}
        </span>
        <span className="sr-only">Student menu: </span>
        <span className="sr-only sm:hidden">{studentId}</span>
        <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">{studentId}</span>
        <ChevronDown className="size-4 text-muted" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
        <p className="truncate px-3 pb-2 text-sm font-medium">{studentId}</p>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate(ROUTES.settings)}>
          <Settings className="size-4" aria-hidden /> Profile &amp; settings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate(ROUTES.help)}>
          <LifeBuoy className="size-4" aria-hidden /> Help
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            clearStudent()
            navigate(ROUTES.start)
          }}
        >
          <LogOut className="size-4" aria-hidden /> Switch student
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
