import { createRouter, createWebHistory } from "vue-router";
import Home from "@/views/Home.vue";
import CreateRoom from "@/views/CreateRoom.vue";
import JoinRoom from "@/views/JoinRoom.vue";
import GameRoom from "@/views/GameRoom.vue";
import LoginForm from "@/views/loginForm.vue";
import { auth } from "@/services/firebase";
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

router.beforeEach((to, _unused, next) => {
  const isAuthenticated = getAuth().currentUser;
  const protectedRoutes = ["/home", "/createRoom", "/joinRoom", "/GameRoom"];

  if (protectedRoutes.some((r) => to.path.startsWith(r)) && !isAuthenticated) {
    next("/"); // Retour vers Login
  } else {
    next();
  }
});

export default router;
