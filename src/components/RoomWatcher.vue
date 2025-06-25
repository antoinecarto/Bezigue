<template>
  <div class="p-4">
    <h1 class="text-2xl font-bold mb-4">Jeu de cartes - Prototype</h1>

    <div v-if="roomId">
      <RoomWatcher :roomId="roomId" />
    </div>

    <div v-else>
      <AutoMatch @room-joined="setRoomId" />
      <hr class="my-4" />
      <CreateRoom @room-created="setRoomId" />
      <hr class="my-4" />
      <JoinRoom @room-joined="setRoomId" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import CreateRoom from './components/CreateRoom.vue'
import JoinRoom from './components/JoinRoom.vue'
import AutoMatch from './components/AutoMatch.vue'
import RoomWatcher from './components/RoomWatcher.vue'

const roomId = ref('')

const setRoomId = (id) => {
  roomId.value = id
}
</script>


