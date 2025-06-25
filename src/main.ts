import { createApp } from 'vue'
import App from './App.vue'
import router from './router' // 👈 ajoute cette ligne

import './style.css'

createApp(App)
  .use(router) // 👈 active le routeur
  .mount('#app')
