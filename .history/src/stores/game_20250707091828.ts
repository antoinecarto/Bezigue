import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  doc,
  onSnapshot,
  runTransaction,
  updateDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { RoomDoc, RoomState } from '@/types/firestore';
import type { Suit } from '@/game/models/Card';
import { generateShuffledDeck, distributeCards } from '@/game/BezigueGame';

/* ──────────── constants & helpers ──────────── */
const RANK_ORDER: Record<string, number> = {
  '7': 1,
  '8': 2,
  '9': 3,
  J: 4,
  Q: 5,
  K: 6,
  '10': 7,
  A: 8,
};

interface ParsedCard {
  suit: Suit;
  rank: number;
}

function parseCard(code: string): ParsedCard {
  const [rankStr, suit] = code.split('_') as [string, Suit];
  return { suit, rank: RANK_ORDER[rankStr] };
}

function resolveTrick(
  firstCard: string,
  secondCard: string,
  firstUid: string,
  secondUid: string,
  trumpSuit: Suit,
): string {
  const A = parseCard(firstCard);
  const B = parseCard(secondCard);

  const trumpA = A.suit === trumpSuit;
  const trumpB = B.suit === trumpSuit;

  // — même couleur (atout ou non) —
  if (A.suit === B.suit) return A.rank >= B.rank ? firstUid : secondUid;

  // — une seule carte est atout —
  if (trumpA && !trumpB) return firstUid;
  if (!trumpA && trumpB) return secondUid;

  // — couleurs différentes, pas d'atout —
  return firstUid; // le meneur l'emporte
}

function splitCode(code: string) {
  const [rankSuit] = code.split('_');
  return {
    rank: rankSuit.slice(0, -1),
    suit: rankSuit.slice(-1) as Suit,
  } as const;
}

/* ──────────── store ──────────── */
export const useGameStore = defineStore('game', () => {
  /* ───────── state ───────── */
  const room = ref<RoomState | null>(null);
  const myUid = ref<string | null>(null);
  const hand = ref<string[]>([]);
  const melds = ref<Record<string, string[]>>({});
  const exchangeTable = ref<Record<string, string>>({});

  const loading = ref(true);
  const drawInProgress = ref(false);
  const playing = ref(false);

  /* ───────── getters ───────── */
  const trumpSuit = computed<Suit>(() => {
    return room.value ? (room.value.trumpCard.split('_').at(-1) as Suit) : 'C';
  });

  const currentTurn = computed(() => room.value?.currentTurn ?? null);

  const canDraw = computed(
    () =>
      room.value?.phase === 'draw' &&
      room.value.drawQueue?.[0] === myUid.value &&
      !drawInProgress.value,
  );

  const getExchange = computed(() => exchangeTable.value);

  const getMeld = (uid: string) => melds.value[uid] ?? [];

  /* ───────── firestore subscription ───────── */
  function _subscribeRoom(roomId: string) {
    return onSnapshot(doc(db, 'rooms', roomId), snap => {
      loading.value = false;
      if (!snap.exists()) {
        room.value = null;
        return;
      }
      const data = snap.data() as RoomDoc;
      room.value = { id: snap.id, ...data };
      if (myUid.value) hand.value = data.hands?.[myUid.value] ?? [];
      melds.value = { ...data.melds };
      exchangeTable.value = { ...(data.exchangeTable ?? {}) };
    });
  }

  /* ───────── actions ───────── */
  async function createRoom(roomId: string, uid: string, opponentUid: string) {
    // shuffle & deal
    const deck = generateShuffledDeck();
    const { hands, deckAfterDeal } = distributeCards(deck, [uid, opponentUid]);
    const trumpCard = deckAfterDeal.pop()!; // dernière carte du talon
    const trump = trumpCard.split('_').at(-1) as Suit;

    const initialRoom: RoomDoc = {
      players: [uid, opponentUid],
      phase: 'play',
      currentTurn: uid, // le donneur commence
      deck: deckAfterDeal,
      trick: { cards: [], players: [] },
      trumpCard,
      trumpSuit: trump,
      hands,
      melds: {},
      exchangeTable: {},
      drawQueue: [],
    } as RoomDoc;

    await setDoc(doc(db, 'rooms', roomId), initialRoom);
  }

  async function updateHand(newHand: string[]) {
    if (!room.value || !myUid.value) return;
    await updateDoc(doc(db, 'rooms', room.value.id), {
      [`hands.${myUid.value}`]: newHand,
    });
    hand.value = [...newHand];
  }

  async function addToMeld(uid: string, code: string) {
    if (!room.value || room.value.phase !== 'play') return;
    const roomRef = doc(db, 'rooms', room.value.id);
    await runTransaction(db, async tx => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error('Room not found');
      const d = snap.data() as RoomDoc;
      const srvHand = [...(d.hands[uid] ?? [])];
      const idx = srvHand.indexOf(code);
      if (idx === -1) throw new Error('Card not in hand');
      srvHand.splice(idx, 1);
      const srvMeld = [...(d.melds?.[uid] ?? []), code];
      tx.update(roomRef, {
        [`hands.${uid}`]: srvHand,
        [`melds.${uid}`]: srvMeld,
      });
    });
  }

  async function drawCard() {
    if (!canDraw.value || !room.value || !myUid.value) return;
    const roomRef = doc(db, 'rooms', room.value.id);
    drawInProgress.value = true;
    try {
      await runTransaction(db, async tx => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) throw new Error('Room missing');
        const d = snap.data() as RoomDoc;
        if (d.phase !== 'draw' || d.drawQueue[0] !== myUid.value)
          throw new Error('Not your draw turn');

        const deck = [...d.deck];
        const card = deck.shift()!;
        const newHand = [...(d.hands[myUid.value] ?? []), card];
        const newQueue = d.drawQueue.slice(1);

        const update: Partial<RoomDoc> & Record<string, any> = {
          deck,
          [`hands.${myUid.value}`]: newHand,
          drawQueue: newQueue,
        };
        if (!newQueue.length) update.phase = 'play';
        tx.update(roomRef, update);
      });
    } finally {
      drawInProgress.value = false;
    }
  }

  async function playCard(code: string) {
    if (
      playing.value ||
      !room.value ||
      room.value.phase !== 'play' ||
      !myUid.value,
    )
      return;
    if (room.value.currentTurn !== myUid.value) return;

    const roomRef = doc(db, 'rooms', room.value.id);
    playing.value = true;
    try {
      await runTransaction(db, async tx => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) throw new Error('Room missing');
        const d = snap.data() as RoomDoc;
        if ((d.trick.cards?.length ?? 0) >= 2) throw new Error('Trick full');

        // — supprime la carte de la main serveur —
        const srvHand = [...(d.hands[myUid.value] ?? [])];
        const idx = srvHand.indexOf(code);
        if (idx === -1) throw new Error('Card not in hand server');
        srvHand.splice(idx, 1);

        const cards = [...(d.trick.cards ?? []), code];
        const players = [...(d.trick.players ?? []), myUid.value];
        const opponent = d.players.find(p => p !== myUid.value)!;

        const update: Record<string, any> = {
          [`hands.${myUid.value}`]: srvHand,
          trick: { cards, players },
          exchangeTable: { ...(d.exchangeTable ?? {}), [myUid.value]: code },
        };

        if (cards.length === 1) {
          update.currentTurn = opponent; // l'autre joue la 2ᵉ carte
        } else if (cards.length === 2) {
          const winner = resolveTrick(
            cards[0],
            cards[1],
            players[0],
            players[1],
            d.trumpSuit as Suit,
          );
          const loser = players.find(p => p !== winner)!;

          update.currentTurn = winner;
          update.trick = { cards: [], players: [] };
          update.exchangeTable = {};

          // ——— PI O C H E ———
          const prospectiveHands = { ...d.hands, [myUid.value]: srvHand };
          const needsCard = (u: string) =>
            (prospectiveHands[u]?.length ?? 0) +
              (d.melds?.[u]?.length ?? 0) <
            9;

          const newQueue: string[] = [];
          if (needsCard(winner)) newQueue.push(winner);
          if (needsCard(loser)) newQueue.push(loser);

          if (newQueue.length && d.deck.length) {
            update.phase = 'draw';
            update.drawQueue = newQueue; // winner puis loser
          }
        }
        tx.update(roomRef, update);
      });
    } finally {
      playing.value = false;
    }
  }

  function joinRoom(roomId: string, uid: string) {
    myUid.value = uid;
    return _subscribeRoom(roomId);
  }

  async function dropToMeld(code: string) {
    if (!room.value || !myUid.value) return;
    await addToMeld(myUid.value, code);
  }

  /* ───────── expose ───────── */
  return {
    // state
    room,
    myUid,
    hand,
    melds,
    exchangeTable,
    loading,
    playing,

    // getters / computed
    trumpSuit,
    canDraw,
    currentTurn,
    getExchange,

    // actions
    createRoom,
    joinRoom,
    playCard,
    drawCard,
    updateHand,
    addToMeld,
    dropToMeld,

    // helpers (exportés pour les tests unitaires)
    resolveTrick,
  };
});