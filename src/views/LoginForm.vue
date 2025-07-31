<template>
  <div class="page-container">
    <h1 class="page-title">Bézigue</h1>

    <div class="login-form">
      <h2 v-if="mode === 'login'">Connexion</h2>
      <h2 v-else>Inscription</h2>

      <form @submit.prevent="submit">
        <input
          type="email"
          v-model="email"
          placeholder="Email"
          required
          autocomplete="username"
        />
        <input
          type="password"
          v-model="password"
          placeholder="Mot de passe"
          required
          autocomplete="current-password"
        />

        <button :disabled="isLoading" type="submit">
          {{ mode === "login" ? "Se connecter" : "S'inscrire" }}
        </button>
      </form>

      <p v-if="error" style="color: red">{{ error }}</p>

      <p>
        <button
          @click="mode = mode === 'login' ? 'register' : 'login'"
          style="margin-top: 1rem"
        >
          {{
            mode === "login"
              ? "Créer un compte"
              : "Déjà un compte ? Connectez-vous"
          }}
        </button>
      </p>

      <p v-if="isLoggedIn">Connecté en tant que : {{ user?.email }}</p>
      <button @click="logout">Se déconnecter</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { auth } from "@/services/firebase";
import { useRouter } from "vue-router";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
const email = ref("");
const password = ref("");
const error = ref("");
const user = ref(null);
const isLoading = ref(false);
const router = useRouter();
const mode = ref("login"); // 'login' ou 'register'

onAuthStateChanged(auth, (u) => {
  user.value = u;
  error.value = "";
  redirectIfLoggedIn();
});

const redirectIfLoggedIn = () => {
  if (user.value && !user.value.isAnonymous && user.value.email) {
    router.push("/home");
  }
};

const submit = async () => {
  error.value = "";
  isLoading.value = true;
  try {
    if (mode.value === "login") {
      await signInWithEmailAndPassword(auth, email.value, password.value);
    } else {
      await createUserWithEmailAndPassword(auth, email.value, password.value);
    }
    router.push("/home");
  } catch (e) {
    error.value = e.message;
  } finally {
    isLoading.value = false;
  }
};

const logout = async () => {
  await signOut(auth);
  user.value = null;
};

const isLoggedIn = computed(() => !!user.value);
</script>
<style scoped>
.page-container {
  max-width: 500px;
  margin: 2rem auto;
  padding: 1rem;
  text-align: center;
}

.page-title {
  font-size: 2rem;
  margin-bottom: 1.5rem;
  font-weight: bold;
}

.login-form {
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  background: white;
}

.login-form input {
  display: block;
  width: 100%;
  margin-bottom: 1rem;
  padding: 0.5rem;
}

.login-form button {
  padding: 0.5rem 1rem;
}
</style>
