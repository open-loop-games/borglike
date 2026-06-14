import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './styles/index.css'
import './ui/icons'
import { useIsMobile } from './ui/composables/use-is-mobile'

const pinia = createPinia()

const loadShell = useIsMobile() ? () => import('./MobileApp.vue') : () => import('./DesktopApp.vue')

void loadShell().then((mod) => {
  const app = createApp(mod.default)
  app.use(pinia)
  app.mount('#app')
})
