<template>
  <div>
    <h2>Salles disponibles</h2>
    <table v-if="rooms.length" class="w-full text-left border-collapse border border-gray-300">
      <thead>
        <tr>
          <th class="border border-gray-300 p-2">Code</th>
          <th class="border border-gray-300 p-2">Joueurs</th>
          <th class="border border-gray-300 p-2">Statut</th>
          <th class="border border-gray-300 p-2">Action</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="room in rooms" :key="room.id" :class="{ 'bg-gray-100': loading && currentRoomId === room.id }">
          <td class="border border-gray-300 p-2">{{ room.id }}</td>
          <td class="border border-gray-300 p-2">{{ room.players.length }} / 2</td>
          <td class="border border-gray-300 p-2">{{ room.status }}</td>
          <td class="border border-gray-300 p-2">
            <button
              :disabled="loading"
              @click="joinRoomFromList(room.id)"
              class="px-3 py-1 bg-blue-500 text-white rounded disabled:bg-gray-400"
            >
              {{ loading && currentRoomId === room.id ? 'Connexion...' : 'Rejoindre' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else>Aucune salle disponible.</p>

    <hr class="my-4" />

    <div>
      <input v-model="roomCode" placeholder="Code de la salle" />
      <button @click="joinRoom" :disabled="loading || !roomCode.trim()">
        {{ loading ? 'Connexion...' : 'Rejoindre' }}
      </button>
      <p v-if="error" class="text-red-600">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { db } from '../firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { getPlayerId } from '../utils/playerId.js'
import { defineEmits } from 'vue'
import { getAuth } from 'firebase/auth'

const roomCode = ref('')
const error = ref('')
const loading = ref(false)
const currentRoomId = ref('')
const rooms = ref<Array<any>>([])

const emit = defineEmits(['room-joined'])

const fetchRooms = async () => {
  // On récupère les rooms avec moins de 2 joueurs et pas finies
  try {
    const roomsRef = collection(db, 'rooms')
    const q = query(
      roomsRef,
      where('status', '!=', 'finished')
      // tu peux ajouter d'autres filtres si besoin
    )
    const querySnap = await getDocs(q)
    const fetchedRooms: Array<any> = []
    querySnap.forEach((docSnap) => {
      const data = docSnap.data()
      const players = Array.isArray(data.players) ? data.players : []
      if (players.length < 2) {
        fetchedRooms.push({ id: docSnap.id, ...data })
      }
    })
    rooms.value = fetchedRooms
  } catch (e) {
    console.error('Erreur récupération salles:', e)
  }
}

onMounted(() => {
  fetchRooms()
})

const joinRoomCommon = async (roomId: string) => {
  error.value = ''
  const auth = getAuth()
  if (!auth.currentUser) {
    error.value = 'Vous devez être connecté pour rejoindre une salle.'
    return false
  }
  loading.value = true
  currentRoomId.value = roomId
  try {
    const uid = getPlayerId()
    const roomRef = doc(db, 'rooms', roomId)
    const roomSnap = await getDoc(roomRef)

    if (!roomSnap.exists()) {
      error.value = 'Salle introuvable.'
      return false
    }

    const room = roomSnap.data()

    if ((room.players || []).length >= 2) {
      error.value = 'La salle est pleine.'
      return false
    }

    // Trouver seat libre
    let seat = ''
    if (!room.players || room.players.length === 0) seat = 'seat1'
    else if (room.players.length === 1) seat = 'seat2'
    else {
      error.value = 'La salle est pleine.'
      return false
    }

    const reservedHand = room.reservedHands?.[seat]
    if (!reservedHand) {
      error.value = "Pas de main réservée pour ce siège."
      return false
    }

    const newPlayers = Array.isArray(room.players) ? [...room.players] : []
    if (!newPlayers.includes(uid)) newPlayers.push(uid)

    const newHands = {
      ...(room.hands || {}),
      [uid]: reservedHand,
    }

    const newReservedHands = { ...(room.reservedHands || {}) }
    delete newReservedHands[seat]

    await updateDoc(roomRef, {
      players: newPlayers,
      hands: newHands,
      reservedHands: newReservedHands,
      status: 'in_progress',
    })

    emit('room-joined', roomId)
    return true
  } catch (e) {
    console.error(e)
    error.value = "Erreur lors de la connexion à la salle."
    return false
  } finally {
    loading.value = false
    currentRoomId.value = ''
  }
}

const joinRoom = async () => {
  if (!roomCode.value.trim()) {
    error.value = "Merci d'entrer un code de salle."
    return
  }
  await joinRoomCommon(roomCode.value.trim())
}

const joinRoomFromList = async (roomId: string) => {
  await joinRoomCommon(roomId)
}
</script>

<style scoped>
table {
  border-collapse: collapse;
}
th, td {
  border: 1px solid #ccc;
  padding: 0.5rem 1rem;
}
</style>
