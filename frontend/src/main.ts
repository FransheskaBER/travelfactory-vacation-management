import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import './style.css'
import App from './App.vue'
import { router } from './router'
import { setUnauthorizedHandler } from './api/client'
import { useAuthStore } from './stores/auth'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

const app = createApp(App).use(pinia).use(router)

// Wired here, once — the client must not import the store (circular dep,
// lint-banned), so the store reaches it via inversion. No token wiring is
// needed: the browser attaches the httpOnly cookie itself.
const auth = useAuthStore(pinia)
setUnauthorizedHandler(() => {
  // Reactive half of expired-session handling (spec 4.8 §4): the server
  // rejected the cookie mid-session — clear locally and start over. Local
  // clear only, no POST /logout: the server already rejected the session.
  auth.clearSession()
  router.push('/login')
})

app.mount('#app')
