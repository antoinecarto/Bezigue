<template>
 <div>
    <!-- Popup saisie du nom -->
     <!-- <div v-if="showNamePopup" class="popup-backdrop">
      <div class="popup">
        <h3>Entrez votre nom :</h3>
        <input v-model="tempPlayerName" placeholder="Votre nom" />
        <button @click="confirmName">Commencer la partie</button>
      </div> 
    </div>  -->

    <!-- Contenu principal -->
    <div>
      <button 
        @click="useAutoMatch = true" 
        :disabled="useAutoMatch"
        class="btn mb-4"
      >
        Recherche automatique d’adversaire
      </button>

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
import { ref, onMounted } from 'vue'
import AutoMatch from '../components/AutoMatch.vue'
import CreateRoom from '../views/CreateRoom.vue'
import JoinRoom from '../views/JoinRoom.vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const useAutoMatch = ref(false)

const playerName = ref('')
const showNamePopup = ref(true)
const tempPlayerName = ref('')

onMounted(() => {
  const savedName = localStorage.getItem('playerName')
  if (savedName) {
    playerName.value = savedName
    showNamePopup.value = false
  }
})

const goToRoom = (roomId) => {
  if (!roomId) return
  router.push(`/room/${roomId}`).catch(() => {})
}

function confirmName() {
  if (tempPlayerName.value.trim()) {
    playerName.value = tempPlayerName.value.trim()
    localStorage.setItem('playerName', playerName.value)
    showNamePopup.value = false
  } else {
    alert('Veuillez entrer un nom')
  }
}
</script>

<style scoped>
.popup-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
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
