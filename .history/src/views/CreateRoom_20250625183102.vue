<template>
  <div class="space-y-4">
    <button
      class="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-40"
      @click="createRoom"
      :disabled="loading"
    >
      {{ loading ? 'Création…' : 'Créer une salle' }}
    </button>

    <p v-if="roomId">ID de la salle&nbsp;: <code>{{ roomId }}</code></p>
  </div>
</template>

<script setup lang="ts">
import { getAuth } from 'firebase/auth'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  collection,
  addDoc,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '@/firebase'               // ton instance Firestore
import { getPlayerId } from '@/utils/playerId'
import {
  generateShuffledDeck,
  distributeCards
} from '@/game/BezigueGame'                   // logique “moteur”

const emit = defineEmits<{ 'room-created': [string] }>()
const router = useRouter()

const roomId = ref<string | null>(null)
const loading = ref(false)

/** Création d'une nouvelle salle et redirection */
const createRoom = async () => {
  loading.value = true
  try {
    const auth = getAuth()
    const uid = auth.currentUser?.uid
    if (!uid) {
      throw new Error('Utilisateur non connecté')
    }

    // Demande du nom de la salle
    const roomName = prompt("Entrez un nom pour la salle :")
    if (!roomName || !roomName.trim()) {
      alert("Le nom de la salle est obligatoire !")
      loading.value = false
      return
    }

    /* --- 1. Infos joueur ---------------------------- */
    const playerId = getPlayerId()

    /* --- 2. Génération + distribution --------------- */
    const fullDeck = generateShuffledDeck()
    const deckInfo = distributeCards(fullDeck)

    /* --- 3. Données Firestore ----------------------- */
    const roomData = {
      name: roomName.trim(),
      createdAt: serverTimestamp(),
      status: 'waiting',
      players: [uid],           // seul le joueur créateur au début
      currentMeneIndex: 0,
      nextTurnIndex: 0,
      currentTurn: uid,     // <-- ici on dit que le premier à jouer est uid1

      trumpCard: deckInfo.trumpCard,
      deck: deckInfo.drawPile,
      hands: {
        [uid]: deckInfo.hands.player1
      },
      reservedHands: {
        seat2: deckInfo.hands.player2
      }
    }

    /* --- 4. Debug logs ----------------------------- */
    console.log('auth uid   =', uid)
    console.log('playerId   =', playerId)
    console.log('player1Hand:', deckInfo.hands.player1)
    console.log('player2Hand:', deckInfo.hands.player2)

    /* --- 5. Écriture Firestore --------------------- */
    const roomRef = await addDoc(collection(db, 'rooms'), roomData)

    /* --- 6. Mise à jour UI ------------------------- */
    roomId.value = roomRef.id
    emit('room-created', roomRef.id)
    router.push(`/room/${roomRef.id}`)
  } catch (err: any) {
    console.error('Erreur lors de la création de la salle :', err)
    alert("Erreur lors de la création de la salle : " + err.message)
  } finally {
    loading.value = false
  }
}
</script>
