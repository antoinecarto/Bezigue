// src/stores/game.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  doc,
  onSnapshot,
  runTransaction,
  updateDoc,
  Transaction,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { detectCombinations } from "@/core/rules/detectCombinations";
import { Card } from "@/game/models/Card.ts"; // classe Card
import type { RoomDoc } from "@/types/firestore";
import { distributeCards, generateShuffledDeck } from "@/game/BezigueGame";

export const useGameStore = defineStore("game", () => {
  /* ──────────── state ──────────── */
  const room = ref<RoomDoc | null>(null);
  const myUid = ref<string | null>(null);
  const hand = ref<string[]>([]); // main du joueur courant
  const meld = ref<string[]>([]); // cartes déposées (zone meld)
  const loading = ref(true);
  const showExchange = ref(false);
  const drawInProgress = ref(false);
  const exchangeTable = ref<Record<string, string>>({});

  /* ──────────── getters ─────────── */
  const meldArea = computed(() => meld.value);
  const trumpSuit = computed(() => room.value?.trumpCard.slice(-1) ?? "");
  const canDraw = computed(() => {
    const r = room.value;
    return (
      r &&
      r.phase === "draw" &&
      r.drawQueue?.[0] === myUid.value &&
      !drawInProgress.value
    );
  });

  /* ──────────── helpers ─────────── */
  function _subscribeRoom(roomId: string) {
    const roomRef = doc(db, "rooms", roomId);

    return onSnapshot(roomRef, (snap) => {
      loading.value = false;
      if (!snap.exists()) {
        room.value = null;
        return;
      }

      room.value = snap.data() as RoomDoc;
      hand.value = room.value?.hands?.[myUid.value ?? ""] ?? [];
    });
  }

  // ------------------------------------------------------------------
  // ACTIONS
  // ------------------------------------------------------------------
  async function setTargetScore(value: number) {
    if (!room.value) return;
    if (room.value.phase !== "waiting") return;
    await updateDoc(doc(db, "rooms", room.value.id), {
      targetScore: value,
    });
  }

  async function drawCard() {
    if (!canDraw.value || !room.value) return;

    drawInProgress.value = true;
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(doc(db, "rooms", room.value!.id));
        const d = snap.data() as RoomDoc;

        if (d.phase !== "draw" || d.drawQueue[0] !== myUid.value)
          throw "Pas votre tour de piocher";

        const deck = [...d.deck];
        const card = deck.shift()!;
        const newHand = [...d.hands[myUid.value!], card];
        const newQueue = d.drawQueue.slice(1);

        const update: Record<string, any> = {
          deck,
          [`hands.${myUid.value}`]: newHand,
          drawQueue: newQueue,
        };

        if (newQueue.length === 0) {
          update.phase = "play";
          update.trick = { cards: [], players: [] };
        }

        tx.update(doc(db, "rooms", room.value!.id), update);
      });
    } finally {
      drawInProgress.value = false;
    }
  }

  /* ---------- échange 7 d’atout ---------------- */
  async function confirmExchange() {
    if (!room.value || !myUid.value) return;
    showExchange.value = false;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(doc(db, "rooms", room.value!.id));
      const d = snap.data() as RoomDoc;

      const sevenCode = "7" + d.trumpSuit;
      if (!d.hands[myUid.value!].includes(sevenCode)) return; // pas de 7

      const allowedRanks = ["A", "10", "K", "Q", "J"];
      if (!allowedRanks.includes(d.trumpCard.slice(0, -1))) return; // carte exposée non échangeable

      // swap
      const hand = d.hands[myUid.value!].filter((c) => c !== sevenCode);
      hand.push(d.trumpCard);

      tx.update(doc(db, "rooms", room.value!.id), {
        trumpCard: sevenCode,
        [`hands.${myUid.value}`]: hand,
      });
    });
  }

  function cancelExchange() {
    showExchange.value = false;
  }
  function joinRoom(roomId: string, uid: string) {
    myUid.value = uid;
    return _subscribeRoom(roomId); // ← renvoie l’unsubscribe
  }

  function updateHand(newHand: string[]) {
    hand.value = [...newHand];
    // TODO : écrire dans Firestore si tu veux persister l’ordre
  }

  async function playCard(code: string) {
    console.log("playCard called with code =", code);
    if (!room.value || room.value.phase !== "play") return;
    const uid = myUid.value; // bien récupérer l'uid ici, avec le bon store

    if (!uid) {
      console.error("UID is undefined");
      return;
    }
    console.log("UID =", uid);
    console.log("Avant runTransaction");
    await runTransaction(db, async (tx) => {
      console.log("Dans runTransaction");
      const roomId = room.value?.id;
      if (!roomId) {
        throw new Error("Room ID is undefined");
      }
      const roomRef = doc(db, "rooms", roomId);
      const roomSnap = await tx.get(roomRef);
      if (!roomSnap.exists()) throw new Error("Room does not exist");

      console.log("roomSnap.exists() =", roomSnap.exists());
      if (!roomSnap.exists()) throw new Error("Room does not exist");

      const roomData = roomSnap.data() as RoomDoc;
      console.log("roomData =", roomData);
      console.log("roomData.hands =", roomData.hands);
      console.log(`roomData.hands[${uid}] =`, roomData.hands?.[uid]);

      const playerHand = [
        ...(Array.isArray(roomData.hands?.[uid]) ? roomData.hands[uid] : []),
      ];
      const idx = playerHand.indexOf(code);
      if (idx === -1) throw new Error("Card not found in hand");
      playerHand.splice(idx, 1);

      const newExchangeTable = { ...(roomData.exchangeTable || {}) };
      newExchangeTable[uid] = code;

      tx.update(roomRef, {
        [`hands.${uid}`]: playerHand,
        exchangeTable: newExchangeTable,
      });
    });
  }

  async function dropToMeld(code: string) {
    const idx = hand.value.indexOf(code);
    if (idx !== -1) {
      hand.value.splice(idx, 1);
      meld.value.push(code);
    }

    const best = detectCombinations(
      meld.value.map(Card.fromCode),
      [],
      trumpSuit.value
    )[0];

    // TODO : traiter la combinaison 'best' (score, etc.)
  }
  // Au démarrage :
  function maybeStartGame(tx: Transaction, d: RoomDoc) {
    if (d.phase !== "waiting") return;
    if (d.players.length !== 2) return;

    const host = d.players[0];
    const guest = d.players.find((u) => u !== host)!;
    const roomRef = doc(db, "rooms", roomId);

    const fullDeck = generateShuffledDeck();
    const distrib = distributeCards(fullDeck);

    if (!distrib.trumpCard) {
      throw new Error("distrib.trumpCard is undefined");
    }

    const hands: Record<string, string[]> = {
      [host]: distrib.hands.player1.map((card) => card.toString()),
      [guest]: distrib.hands.player2.map((card) => card.toString()),
    };

    console.log("Starting game with hands:", hands);
    console.log("Trump card:", distrib.trumpCard.toString());

    tx.set(
      roomRef,
      {
        phase: "play",
        currentTurn: host,
        deck: distrib.drawPile.map((card) => card.toString()),
        trumpCard: distrib.trumpCard.toString(),
        trumpTaken: false,
        trumpSuit: distrib.trumpCard.toString().slice(-1) as Suit,
        hands,
        melds: {},
        trick: { cards: [], players: [] },
        drawQueue: [],
        exchangeTable: {}, // <-- initialisation ici
      },
      { merge: true }
    );
  }

  /* ──────────── expose ──────────── */
  return {
    // state
    room,
    myUid,
    hand,
    meld,
    loading,

    // getters
    meldArea,
    trumpSuit,
    canDraw,

    // actions
    joinRoom,
    updateHand,
    playCard,
    dropToMeld,
    setTargetScore,
    drawCard,
    confirmExchange,
    cancelExchange,
    maybeStartGame,
  };
});
