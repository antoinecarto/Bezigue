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
  addDoc, updateDoc, doc, arrayUnion, serverTimestamp, getDoc
} from 'firebase/firestore'
import { getPlayerId } from '../utils/playerId.js'
import { distributeCards } from '../game/BezigueGame.ts'  // ta fonction de distribution
import { getAuth } from 'firebase/auth'

const emit = defineEmits(['room-joined'])

const loading = ref(false)
const error = ref('')
const playerId = getPlayerId()

const autoJoinRoom = async () => {
  loading.value = true
  error.value = ''

    // 1. Vérifier si utilisateur connecté
  const auth = getAuth()
  if (!auth.currentUser) {
    error.value = 'Vous devez être connecté pour rejoindre une salle.'
    return
  }

  try {
    // 1. Cherche une salle en attente (status = 'waiting')
    const q = query(collection(db, 'rooms'), where('status', '==', 'waiting'))
    const querySnapshot = await getDocs(q)

    let joined = false

    for (const docSnap of querySnapshot.docs) {
      const roomData = docSnap.data()
      const players = roomData.players || []

      // Vérifie salle avec un seul joueur différent de nous
      if (players.length === 1 && players[0] !== playerId) {
        const roomRef = doc(db, 'rooms', docSnap.id)

        // Récupère le deck complet depuis la salle ou génère un nouveau deck
        // Ici on suppose que la salle a déjà le deck (sinon générer et distribuer)
        let fullDeck = roomData.deck
        if (!fullDeck || fullDeck.length === 0) {
          fullDeck = generateShuffledDeck() // ta fonction à créer si nécessaire
        }

        // Distribue les cartes
        const { hands, trumpCard, drawPile } = distributeCards(fullDeck)

        // Mise à jour de la salle avec ce joueur, mains, pioche, atout et statut
        await updateDoc(roomRef, {
          players: arrayUnion(playerId),
          hands: {
            [players[0]]: hands.player1,
            [playerId]: hands.player2
          },
          deck: drawPile,
          trumpCard,
          status: 'in_progress',
          nextTurnIndex: 0,
          reservedHands: {},  // vide les mains réservées
        })

        emit('room-joined', docSnap.id)
        joined = true
        break
      }
    }

    // 2. Si aucune salle trouvée, créer une nouvelle salle "waiting"
    if (!joined) {
      const fullDeck = generateShuffledDeck()
      const { hands, trumpCard, drawPile } = distributeCards(fullDeck)

      // Crée la salle avec le joueur 1, mains réservées pour le 2e
      const newRoomRef = await addDoc(collection(db, 'rooms'), {
        createdAt: serverTimestamp(),
        players: [playerId],
        hands: {
          [playerId]: hands.player1
        },
        reservedHands: {
          seat2: hands.player2
        },
        deck: drawPile,
        trumpCard,
        status: 'waiting',
        nextTurnIndex: 0,
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
