import { createRouter, createWebHistory } from "vue-router";
import Home from "@/views/Home.vue";
import CreateRoom from "@/views/CreateRoom.vue";
import JoinRoom from "@/views/JoinRoom.vue";
import GameRoom from "@/views/GameRoom.vue";
import LoginForm from "@/views/loginForm.vue";
import { auth } from "@/services/firebase";

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

// Fonction qui retourne une Promise qui attend que Firebase ait chargé l'utilisateur
function getCurrentUser() {
  return new Promise((resolve, reject) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user);
    }, reject);
  });
}

router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.path === "/home";
  if (requiresAuth) {
    const user = await getCurrentUser();
    if (!user) {
      return next("/"); // pas connecté → login
    }
  }
  next(); // autorisé
});

export default router;
