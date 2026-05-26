/**
 * TUI Bootstrap
 *
 * Sets `globalThis.__APP_VERSION__` before any persistence-package module is
 * imported. In the Vite browser build, `__APP_VERSION__` is replaced literal-
 * wise at compile time via `define` (see vite.config.ts), so this file isn't
 * involved. Under tsx (the TUI runtime), no such replacement happens, so we
 * stash the version on globalThis where the free identifier reference in
 * `core.ts:SAVE_VERSION` will resolve.
 *
 * Imported FIRST in src/tui/main.ts — ES module evaluation order (post-order
 * DFS of the dep graph) guarantees this body runs before core.ts's body.
 */

import pkg from '../../package.json' with { type: 'json' }
;(globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = pkg.version
