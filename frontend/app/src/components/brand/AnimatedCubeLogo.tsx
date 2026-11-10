import { cn } from '@/lib/cn'

export type CubeMotion = 'spin' | 'hover' | 'none'

interface Props {
  /** edge length in px */
  size?: number
  /** spin: always rotating; hover: rotates while a parent `.group` is hovered; none: static pose */
  motion?: CubeMotion
  /** hide the glow + ground shadow (tight spaces such as the sidebar) */
  bare?: boolean
  className?: string
}

const FACES = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6']

/** The NeuroTutor mark: a 3D cube whose faces carry a small node-and-edge lattice (the knowledge
 *  graph on a solid). Pure CSS 3D transforms -- see styles/cube.css for how it stays cheap and how
 *  prefers-reduced-motion is honoured. Decorative: hidden from assistive tech. */
export function AnimatedCubeLogo({ size = 56, motion = 'spin', bare = false, className }: Props) {
  return (
    <div className={cn('nt-cube-wrap', className)} style={{ ['--s' as string]: `${size}px` }} data-motion={motion} aria-hidden>
      {!bare && <div className="nt-glow" />}
      <div className="nt-scene">
        <div className="nt-tilt">
          <div className="nt-cube">
            {FACES.map((f) => (
              <i key={f} className={`nt-face ${f}`} />
            ))}
            <div className="nt-core">
              {FACES.map((f) => (
                <i key={f} className={`nt-face ${f}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
      {!bare && <div className="nt-shadow" />}
    </div>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-lg font-semibold tracking-tight', className)}>
      Neuro<span className="text-primary">Tutor</span>
    </span>
  )
}
