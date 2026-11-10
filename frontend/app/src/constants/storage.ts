export const STORAGE_KEYS = {
  /** Kept identical to the legacy app so both agree on who is signed in during migration. */
  currentStudent: 'neurotutor_current_student',
  recentStudents: 'neurotutor_recent_students',
  theme: 'neurotutor_theme',
  reduceMotion: 'neurotutor_reduce_motion',
  shortcuts: 'neurotutor_shortcuts',
  sidebarCollapsed: 'neurotutor_sidebar_collapsed',
  booted: 'nt_booted',
} as const

/** Safe wrappers: storage can throw (private mode, blocked cookies). */
export const safeStorage = {
  get(key: string, store: Storage | undefined = globalThis.localStorage): string | null {
    try {
      return store?.getItem(key) ?? null
    } catch {
      return null
    }
  },
  set(key: string, value: string, store: Storage | undefined = globalThis.localStorage): void {
    try {
      store?.setItem(key, value)
    } catch {
      /* ignore */
    }
  },
  remove(key: string, store: Storage | undefined = globalThis.localStorage): void {
    try {
      store?.removeItem(key)
    } catch {
      /* ignore */
    }
  },
}
