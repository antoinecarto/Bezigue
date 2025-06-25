<template>
  <div class="text-center">
    <button @click="autoJoinRoom" :disabled="loading" class="btn">
      {{ loading ? 'Recherche de joueur...' : 'Jouer' }}
    </button>
    <p v-if="error" class="text-red-500 mt-2">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { db } from '../firebase'
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, doc, arrayUnion, serverTimestamp
} from 'firebase/firestore'
import { getPlayerId } from '../utils/playerId.js'

const emit = defineEmits(['room-joined'])

const loading = ref(false)
const error = ref('')

const playerId = getPlayerId()

const autoJoinRoom = async () => {
  loading.value = true
  error.value = ''

  try {
    // 1. Cherche une salle en attente
    const q = query(collection(db, 'rooms'), where('status', '==', 'waiting'))
    const querySnapshot = await getDocs(q)

    let joined = false

    for (const docSnap of querySnapshot.docs) {
      const roomData = docSnap.data()
      const players = roomData.players || []

      // On vérifie que la salle contient exactement 1 joueur et que ce n'est pas ce joueur
      if (players.length === 1 && players[0] !== playerId) {
        const roomRef = doc(db, 'rooms', docSnap.id)

        // Ajoute ce joueur à la salle et passe le statut à 'full'
        await updateDoc(roomRef, {
          players: arrayUnion(playerId),
          status: 'full'
        })

        emit('room-joined', docSnap.id)
        joined = true
        break
      }
    }

    // 2. Si aucune salle trouvée, on crée une nouvelle salle
    if (!joined) {
      const newRoomRef = await addDoc(collection(db, 'rooms'), {
        createdAt: serverTimestamp(),
        players: [playerId],
        status: 'waiting'
      })

      emit('room-joined', newRoomRef.id)
    }
  } catch (err) {
    console.error('Erreur AutoMatch:', err)
    error.value = 'Impossible de rejoindre ou créer une salle.'
  } finally {
    loading.value = false
  }
}
</script>
