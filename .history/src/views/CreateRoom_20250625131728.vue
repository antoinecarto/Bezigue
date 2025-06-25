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
import { getAuth } from 'firebase/auth';
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

const emit   = defineEmits<{ 'room-created': [string] }>()
const router = useRouter()

const roomId  = ref<string | null>(null)
const loading = ref(false)

const auth    = getAuth();
const uid     = auth.currentUser?.uid;       // UID Firebase obligatoire
const aliasId = getPlayerId();               // ton identifiant “humain”


/** Création d'une nouvelle salle et redirection */
const createRoom = async () => {
  loading.value = true
  try {
        const auth = getAuth();
        const uid = auth.currentUser?.uid;
        if (!uid) {
          throw new Error('Utilisateur non connecté');
        }
    /* --- 1. Infos joueur ---------------------------- */
    const playerId = getPlayerId()  // UID ou pseudo local

    /* --- 2. Génération + distribution --------------- */
    const fullDeck = generateShuffledDeck()   // 32 cartes mélangées
    const deckInfo = distributeCards(fullDeck)  // distribue aux deux joueurs + pioche + atout
    
    // deckInfo = { hands: { player1: [...], player2: [...] }, trumpCard: "A♥", drawPile: [...] }

    /* --- 3. Données Firestore ----------------------- */
    const roomData = {
      createdAt: serverTimestamp(),
      status: 'waiting',            // waiting → in_progress
      players: [uid],          // UID dans players[]
      
      nextTurnIndex: 0,             // premier joueur à jouer (index 0)

      trumpCard: deckInfo.trumpCard,  // ex. "A♥"
      deck: deckInfo.drawPile,         // pioche restante

      hands: {
        [playerId]: deckInfo.hands.player1
      },
      reservedHands: {
        seat2: deckInfo.hands.player2  // la main du joueur 2 stockée côté serveur
      }
    }

    /* --- 4. Debug logs ----------------------------- */
    console.log('auth uid   =', getAuth().currentUser?.uid)
    console.log('playerId   =', playerId)
    console.log('player1Hand:', deckInfo.hands.player1)
    console.log('player2Hand:', deckInfo.hands.player2)

    /* --- 5. Écriture Firestore --------------------- */
    const roomRef = await addDoc(collection(db, 'rooms'), roomData)

    /* --- 6. Mise à jour UI ------------------------- */
    roomId.value = roomRef.id
    emit('room-created', roomRef.id)
    router.push(`/room/${roomRef.id}`)
  } catch (err) {
    console.error('Erreur lors de la création de la salle :', err)
  } finally {
    loading.value = false
  }
}

</script>
