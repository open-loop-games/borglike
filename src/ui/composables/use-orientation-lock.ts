/** Lock/unlock screen orientation for mobile expanded run view.
 * Uses the Screen Orientation API which is available on mobile browsers
 * but not fully typed in TypeScript's default lib. */
export function useOrientationLock() {
  // Screen Orientation API lock/unlock aren't in TS's default lib typings
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: string) => Promise<void>
    unlock?: () => void
  }

  async function lockLandscape() {
    try {
      await orientation.lock?.('landscape')
    } catch {
      // Not supported or requires fullscreen — fail silently
    }
  }

  function unlock() {
    try {
      orientation.unlock?.()
    } catch {
      // Fail silently
    }
  }

  return { lockLandscape, unlock }
}
