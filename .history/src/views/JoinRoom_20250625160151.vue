<template>
  <div>
    <h2>Salles disponibles</h2>
    <p v-if="error" class="text-red-600">{{ error }}</p>
    <p v-if="loadingRooms">Chargement des salles...</p>
    <table v-if="rooms.length > 0" class="w-full border-collapse">
      <thead>
        <tr>
          <th class="border px-2 py-1">Nom de la salle</th>
          <th class="border px-2 py-1">Code</th>
          <th class="border px-2 py-1">Action</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="room in rooms" :key="room.id">
          <td class="border px-2 py-1">{{ room.name || room.id }}</td>
          <td class="border px-2 py-1">{{ room.id }}</td>
          <td class="border px-2 py-1">
            <button
              @click="joinRoom(room.id)"
              :disabled="loading || !uid"
            >
              {{ loading ? 'Connexion...' : 'Rejoindre' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else>Aucune salle disponible pour le moment.</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { getPlayerId } from '../utils/playerId.js'
import { defineEmits } from 'vue'
import { getAuth, onAuthStateChanged } from 'firebase/auth'


const rooms = ref<Array<any>>([])
const loadingRooms = ref(false)
const loading = ref(false)
const error = ref('')
const uid = ref('')
const emit = defineEmits(['room-joined'])

const fetchRooms = async () => {
  loadingRooms.value = true
  error.value = ''
  try {
    const q = query(collection(db, 'rooms'), where('status', '==', 'waiting'))
    const querySnapshot = await getDocs(q)
    rooms.value = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  } catch (e) {
    console.error('Erreur récupération salles:', e)
    error.value = 'Erreur récupération salles.'
  } finally {
    loadingRooms.value = false
  }
}

let intervalId: number | null = null

onMounted(() => {
  const auth = getAuth()
  onAuthStateChanged(auth, (user) => {
    if (user) {
      uid.value = user.uid
      error.value = ''
      fetchRooms()
      if (!intervalId) {
        intervalId = setInterval(() => {
          if (uid.value) fetchRooms()
        }, 5000)
      }
    } else {
      uid.value = ''
      error.value = 'Vous devez être connecté pour voir les salles.'
      rooms.value = []
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    }
  })
})


onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
})

const joinRoom = async (roomCode: string) => {
  error.value = ''
  if (!uid.value) {
    error.value = 'Vous devez être connecté pour rejoindre une salle.'
    return
  }

  loading.value = true
  try {
    const roomRef = doc(db, 'rooms', roomCode)
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

    const reservedHand = room.reservedHands?.[seat]
    if (!reservedHand) {
      error.value = "Pas de main réservée pour ce siège."
      loading.value = false
      return
    }

    const newPlayers = Array.isArray(room.players) ? [...room.players] : []
    if (!newPlayers.includes(uid.value)) {
      newPlayers.push(uid.value)
    }

    const newHands = {
      ...(room.hands || {}),
      [uid.value]: reservedHand,
    }

    const newReservedHands = { ...(room.reservedHands || {}) }
    delete newReservedHands[seat]

    await updateDoc(roomRef, {
      players: newPlayers,
      hands: newHands,
      reservedHands: newReservedHands,
      status: 'in_progress',
    })

    emit('room-joined', roomCode)
  } catch (e) {
    console.error(e)
    error.value = 'Erreur lors de la connexion à la salle.'
  } finally {
    loading.value = false
  }
}
</script>
