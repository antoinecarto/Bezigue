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
    /* --- 1. Infos joueur ---------------------------- */
    const playerId = getPlayerId()            // UID ou pseudo local

    /* --- 2. Génération + distribution --------------- */
    const fullDeck = generateShuffledDeck()   // 32 cartes mélangées
    const {
      hands,
      trumpCard,
      drawPile
    } = distributeCards(fullDeck)             // 8 - 8 - pioche

    const deckInfo = distributeCards(generateShuffledDeck());

    /* --- 3. Données Firestore ----------------------- */
    const roomData = {
      createdAt:      serverTimestamp(),
      status:         'waiting',              // waiting → in_progress
      players:        [uid],                // ✅ l’UID dans players[]

      nextTurnIndex:  0,                      // premier coup attendu
      trumpCard:      deckInfo.trumpCard,    // ex. "A♥"
      deck:           deckInfo.drawPile,     // pioche restante
      hands: {
         [uid]: deckInfo.player1Hand
      },
      /* on garde la main destinée au futur joueur 2
         pour éviter de redistribuer ou de la stocker côté client */
      reservedHands: {
          seat2: deckInfo.player2Cards      }
    }

      
console.log('auth uid   =', getAuth().currentUser?.uid);
console.log('playerId   =', getPlayerId());

 


    /* --- 4. Écriture ------------------------------- */
    const roomRef = await addDoc(collection(db, 'rooms'), roomData)

    /* --- 5. Retour UI ------------------------------ */
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
