<template>
  <div>
    <input v-model="roomCode" placeholder="Code de la salle" />
    <button @click="joinRoom" :disabled="loading || !roomCode.trim()">
      {{ loading ? 'Connexion...' : 'Rejoindre' }}
    </button>
    <p v-if="error" class="text-red-600">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { db } from '../firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { getPlayerId } from '../utils/playerId.js'
import { defineEmits } from 'vue'

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
    const uid = getPlayerId()
    const roomRef = doc(db, 'rooms', roomCode.value.trim())
    const roomSnap = await getDoc(roomRef)

    if (!roomSnap.exists()) {
      error.value = 'Salle introuvable.'
      loading.value = false
      return
    }

    const room = roomSnap.data()

    if ((room.players || []).length >= 2) {
      error.value = 'La salle est pleine.'
      loading.value = false
      return
    }

    // Déterminer le seat libre (seat1 ou seat2)
    let seat = ''
    if (!room.players || room.players.length === 0) {
      seat = 'seat1'
    } else if (room.players.length === 1) {
      seat = 'seat2'
    } else {
      error.value = 'La salle est pleine.'
      loading.value = false
      return
    }

    // Récupérer la main réservée pour ce seat
    const reservedHand = room.reservedHands?.[seat]
    if (!reservedHand) {
      error.value = "Pas de main réservée pour ce siège."
      loading.value = false
      return
    }

    // Mise à jour des joueurs et des mains
    const newPlayers = Array.isArray(room.players) ? [...room.players] : []
    if (!newPlayers.includes(uid)) {
      newPlayers.push(uid)
    }

    const newHands = {
      ...(room.hands || {}),
      [uid]: reservedHand,
    }

    const newReservedHands = { ...(room.reservedHands || {}) }
    delete newReservedHands[seat]

    // Mise à jour Firestore
    await updateDoc(roomRef, {
      players: newPlayers,
      hands: newHands,
      reservedHands: newReservedHands,
      status: 'in_progress',
    })

    emit('room-joined', roomCode.value.trim())
  } catch (e) {
    console.error(e)
    error.value = "Erreur lors de la connexion à la salle."
  } finally {
    loading.value = false
  }
}
</script>
