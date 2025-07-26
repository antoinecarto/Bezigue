<template>
  <div>
    <!-- Contenu principal -->
    <div>
      <div v-if="useAutoMatch">
        <AutoMatch @room-joined="goToRoom" :playerName="playerName" />
        <button @click="useAutoMatch = false" class="btn mt-4">
          Retour aux options manuelles
        </button>
      </div>

      <div v-else>
        <CreateRoom @room-created="goToRoom" :playerName="playerName" />
        <hr class="my-4" />
        <JoinRoom @room-joined="goToRoom" :playerName="playerName" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import CreateRoom from "../views/CreateRoom.vue";
import JoinRoom from "../views/JoinRoom.vue";
import { useRouter } from "vue-router";

const router = useRouter();
const useAutoMatch = ref(false);

const playerName = ref("");
const showNamePopup = ref(true);
const tempPlayerName = ref("");

onMounted(() => {
  const savedName = localStorage.getItem("playerName");
  if (savedName) {
    playerName.value = savedName;
    showNamePopup.value = false;
  }
});

const goToRoom = (roomId) => {
  if (!roomId) return;
  router.push(`/room/${roomId}`).catch(() => {});
};

function confirmName() {
  if (tempPlayerName.value.trim()) {
    playerName.value = tempPlayerName.value.trim();
    localStorage.setItem("playerName", playerName.value);
    showNamePopup.value = false;
  } else {
    alert("Veuillez entrer un nom");
  }
}
</script>

<style scoped>
.popup-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}
.popup {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  width: 300px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
