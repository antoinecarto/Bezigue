// composables/useGameRoom.ts
import { ref, computed, onUnmounted } from 'vue';
import {
  doc, collection, query, orderBy,
  onSnapshot, getFirestore
} from 'firebase/firestore';

const db = getFirestore();          // supposé initialisé ailleurs

export function useGameRoom(roomId: string) {
  /* ---------- Réactifs ---------- */
  const room       = ref<any | null>(null);
  const menes      = ref<any[]>([]);            // historique complet
  const currentMene = computed(() =>
    menes.value.find(m => m.phase !== 'finished')
      ?? menes.value[menes.value.length - 1]     // fallback
  );

  /* ---------- Listeners ---------- */
  const unsubRoom = onSnapshot(
    doc(db, 'rooms', roomId),
    snap => { room.value = snap.data(); }
  );

  const unsubMenes = onSnapshot(
    query(
      collection(db, 'rooms', roomId, 'menes'),
      orderBy('meneNumber')
    ),
    qSnap => {
      menes.value = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  );

  /* ---------- Méthodes ---------- */
  function stop() {
    unsubRoom();  unsubMenes();
  }
  onUnmounted(stop);

  return {
    room, menes, currentMene, stop
  };
}
