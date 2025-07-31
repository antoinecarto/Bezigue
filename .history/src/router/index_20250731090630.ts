import { createRouter, createWebHistory } from "vue-router";
import Home from "@/views/Home.vue";
import CreateRoom from "@/views/CreateRoom.vue";
import JoinRoom from "@/views/JoinRoom.vue";
import GameRoom from "@/views/GameRoom.vue";
import LoginForm from "@/views/loginForm.vue";
import { getAuth } from "firebase/auth";

const routes = [
  { path: "/", name: "Login", component: LoginForm },
  { path: "/home", name: "Home", component: Home },
  { path: "/create", name: "CreateRoom", component: CreateRoom },
  { path: "/join", name: "JoinRoom", component: JoinRoom },
  { path: "/room/:roomId", name: "GameRoom", component: GameRoom, props: true },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);
  const isAuthenticated = getAuth().currentUser;

  if (requiresAuth && !isAuthenticated) {
    next({ name: "Login" }); // Rediriger vers le login
  } else {
    next(); // Autoriser la navigation
  }
});

export default router;
