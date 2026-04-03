import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'

const isMobile = window.matchMedia('(max-width: 768px)').matches && 'ontouchstart' in window

const pinia = createPinia()

const loadShell = isMobile
  ? () => import('./MobileApp.vue')
  : () => import('./DesktopApp.vue')

void loadShell().then((mod) => {
  const app = createApp(mod.default)
  app.use(pinia)
  app.mount('#app')
})
