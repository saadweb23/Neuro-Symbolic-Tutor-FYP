import { Blocks, Database, GitBranch, Puzzle, Wrench, type LucideIcon } from 'lucide-react'

/** One fixed icon per curriculum block (block order is fixed by the backend's concept list). */
export const BLOCK_ICONS: LucideIcon[] = [Blocks, GitBranch, Database, Puzzle, Wrench]
