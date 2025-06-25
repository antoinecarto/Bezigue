import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue'
import CreateRoom from '@/views/CreateRoom.vue'
import JoinRoom from '@/views/JoinRoom.vue'
import GameRoom from '@/views/GameRoom.vue'

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/create', name: 'CreateRoom', component: CreateRoom },
  { path: '/join', name: 'JoinRoom', component: JoinRoom },
  { path: '/room/:roomId', name: 'GameRoom', component: GameRoom, props: true },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router

