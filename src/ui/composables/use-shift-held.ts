import { ref, type Ref } from 'vue'

const shiftHeld = ref(false)
let listening = false

/**
 * Singleton composable that tracks whether the Shift key is held.
 * Resets on window blur (prevents stuck state on Alt-Tab).
 */
export function useShiftHeld(): Ref<boolean> {
  if (!listening) {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') shiftHeld.value = true
    })
    window.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') shiftHeld.value = false
    })
    window.addEventListener('blur', () => {
      shiftHeld.value = false
    })
    listening = true
  }
  return shiftHeld
}
