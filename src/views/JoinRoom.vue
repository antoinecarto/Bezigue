<template>
  <div>
    <input v-model="roomCode" placeholder="Code de la salle" />
    <button @click="joinRoom" :disabled="loading || !roomCode.trim()">
      {{ loading ? 'Connexion...' : 'Rejoindre' }}
    </button>
    <p v-if="error" class="text-red-600">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { db } from '../firebase'
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore'
import { getPlayerId } from '../utils/playerId.js'


const roomCode = ref('')
const error = ref('')
const loading = ref(false)
const emit = defineEmits(['room-joined'])

const joinRoom = async () => {
  error.value = ''
  if (!roomCode.value.trim()) {
    error.value = "Merci d'entrer un code de salle."
    return
  }
  loading.value = true
  try {
    const roomRef = doc(db, 'rooms', roomCode.value.trim())
    const roomSnap = await getDoc(roomRef)

    if (roomSnap.exists()) {
      const room = roomSnap.data()
      if ((room.players || []).length < 2) {
        await updateDoc(roomRef, {
          players: arrayUnion(getPlayerId())
        })
        emit('room-joined', roomCode.value.trim())
      } else {
        error.value = 'La salle est pleine.'
      }
    } else {
      error.value = 'Salle introuvable.'
    }
  } catch (e) {
    console.error(e)
    error.value = "Erreur lors de la connexion à la salle."
  } finally {
    loading.value = false
  }
}
</script>

