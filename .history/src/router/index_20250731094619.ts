import { createRouter, createWebHistory } from "vue-router";
import Home from "@/views/Home.vue";
import CreateRoom from "@/views/CreateRoom.vue";
import JoinRoom from "@/views/JoinRoom.vue";
import GameRoom from "@/views/GameRoom.vue";
import LoginForm from "@/views/LoginForm.vue";
import { getAuth, onAuthStateChanged } from "firebase/auth";

const routes = [
  { path: "/", name: "Login", component: LoginForm },
  {
    path: "/home",
    name: "Home",
    component: Home,
    meta: { requiresAuth: true },
  },
  {
    path: "/create",
    name: "CreateRoom",
    component: CreateRoom,
    meta: { requiresAuth: true },
  },
  {
    path: "/join",
    name: "JoinRoom",
    component: JoinRoom,
    meta: { requiresAuth: true },
  },
  {
    path: "/room/:roomId",
    name: "GameRoom",
    component: GameRoom,
    props: true,
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// 🔒 Garde de navigation
router.beforeEach((to, _unused, next) => {
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);
  const auth = getAuth();

  const waitForAuth = new Promise<void>((resolve) => {
    onAuthStateChanged(auth, () => resolve());
  });

  waitForAuth.then(() => {
    const isAuthenticated = auth.currentUser;

    if (requiresAuth && !isAuthenticated) {
      next({ name: "Login" });
    } else {
      next();
    }
  });
});

export default router;
