const isMobileShell =
  typeof window !== 'undefined' &&
  window.matchMedia('(max-width: 768px)').matches &&
  'ontouchstart' in window

/**
 * Shell-level mobile flag, evaluated once at module load.
 *
 * Source of truth for the dual-shell split in `main.ts` (DesktopApp vs MobileApp).
 * Stays a constant because the shell choice is locked in for the session — we
 * deliberately do not react to viewport changes here.
 */
export function useIsMobile(): boolean {
  return isMobileShell
}
