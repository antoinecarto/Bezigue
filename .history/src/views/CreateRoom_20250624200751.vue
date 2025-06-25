<template>
  <div>
    <button @click="createRoom" :disabled="loading">
      {{ loading ? 'Création...' : 'Créer une salle' }}
    </button>
    <p v-if="roomId">ID de la salle : {{ roomId }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { db } from '../firebase'
import { useRouter } from 'vue-router'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { getPlayerId } from '../utils/playerId.js'
// Import depuis Bezigue.ts (fichier métier)
import { generateShuffledDeck, distributeCards } from '../game/BezigueGame'

const emit = defineEmits(['room-created'])
const router = useRouter()
const roomId = ref('')
const loading = ref(false)

const createRoom = async () => {
  loading.value = true
  try {
    const playerId = getPlayerId()
    const fullDeck = generateShuffledDeck()

    // Distribution
    const { player1Hand, player2Cards, trumpCard, drawPile } = distributeCards(fullDeck)

    const roomData = {
      createdAt: serverTimestamp(),
      players: [playerId],
      status: 'waiting',
      deck: drawPile, // reste de la pioche
      hands: {
        [playerId]: player1Hand // main du créateur
      },
      reservedHands: {
        // on stocke la main réservée pour le futur 2ème joueur
        reservedPlayer2: player2Cards
      },
      trump: trumpCard
    }

    const roomRef = await addDoc(collection(db, 'rooms'), roomData)
    roomId.value = roomRef.id
    emit('room-created', roomRef.id)
    router.push(`/room/${roomRef.id}`)
  } catch (err) {
    console.error('Erreur lors de la création de la salle:', err)
  }
  loading.value = false
}
</script>

