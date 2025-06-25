<template>
  <div class="text-center">
    <button @click="autoJoinRoom" :disabled="loading" class="btn">
      {{ loading ? 'Recherche de joueur…' : 'Jouer' }}
    </button>
    <p v-if="error" class="text-red-500 mt-2">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { db } from '../firebase'
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, doc, getDoc, serverTimestamp
} from 'firebase/firestore'
import { distributeCards, generateShuffledDeck } from '../game/BezigueGame'
import { getAuth } from 'firebase/auth'

const emit    = defineEmits(['room-joined'])
const loading = ref(false)
const error   = ref('')

/* -------------------------------------------------------------------------- */
/*                       FONCTION D’APPARIEMENT AUTOMATIQUE                   */
/* -------------------------------------------------------------------------- */
const autoJoinRoom = async () => {
  loading.value = true
  error.value   = ''

  /* --- 0. Vérifie l’authentification ------------------------------------- */
  const uid = getAuth().currentUser?.uid
  if (!uid) {
    error.value   = 'Vous devez être connecté pour rejoindre une salle.'
    loading.value = false
    return
  }

  try {
    /* --- 1. Recherche d’une room « waiting » ----------------------------- */
    const waitingQ   = query(collection(db, 'rooms'), where('status', '==', 'waiting'))
    const waitingSnap = await getDocs(waitingQ)

    for (const roomDoc of waitingSnap.docs) {
      const data     = roomDoc.data()
      const players: string[] = data.players || []

      // Room libre : exactement 1 joueur et ce n’est pas nous
      if (players.length === 1 && players[0] !== uid) {
        const roomRef = doc(db, 'rooms', roomDoc.id)

        /* --- 2. Prépare le payload d’update sans arrayUnion --------------- */
        const seat2          = data.reservedHands?.seat2 ?? {}
        const seat2Cards: string[] =
          Array.isArray(seat2) ? seat2 : seat2.cards || []

        const payload: Record<string, unknown> = {
          players: [...players, uid],        // tableau complet → OK pour les règles
          status : 'in_progress',
          nextTurnIndex: 0,

          // main du nouveau joueur
          [`hands.${uid}`]: seat2Cards,

          // on renseigne quel UID occupe seat2
          'reservedHands.seat2.playerId': uid
        }

        await updateDoc(roomRef, payload)

        emit('room-joined', roomDoc.id)
        loading.value = false
        return
      }
    }

    /* --- 3. Aucune room disponible → on en crée une ---------------------- */
    const deck                  = generateShuffledDeck()
    const { hands, trumpCard, drawPile } = distributeCards(deck)

    const newRoomRef = await addDoc(collection(db, 'rooms'), {
      createdAt:   serverTimestamp(),
      status:      'waiting',
      players:     [uid],
      nextTurnIndex: 0,

      trumpCard,
      deck: drawPile,

      hands: { [uid]: hands.player1 },
      reservedHands: {
        seat2: { cards: hands.player2 }      // pas encore de playerId
      }
    })

    emit('room-joined', newRoomRef.id)
  } catch (e) {
    console.error('Erreur AutoMatch :', e)
    error.value = 'Impossible de rejoindre ou créer une salle.'
  } finally {
    loading.value = false
  }
}
</script>
