import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import './style.css'
import App from './App.vue'
import { router } from './router'
import { setTokenProvider, setUnauthorizedHandler } from './api/client'
import { useAuthStore } from './stores/auth'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

const app = createApp(App).use(pinia).use(router)

// Both hooks wired here, once — the client must not import the store
// (circular dep, lint-banned), so the store reaches it via inversion.
const auth = useAuthStore(pinia)
setTokenProvider(() => auth.token)
setUnauthorizedHandler(() => {
  // Reactive half of expired-token handling (spec 4.8 §4): the server
  // rejected the token mid-session — drop it and start over.
  auth.logout()
  router.push('/login')
})

app.mount('#app')
