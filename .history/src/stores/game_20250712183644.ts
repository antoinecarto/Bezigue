// src/stores/game.ts
import { defineStore } from "pinia";
import { ref, computed, watchEffect } from "vue";
import { doc, onSnapshot, runTransaction, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import type { RoomDoc, RoomState } from "@/types/firestore";
import type { Suit } from "@/game/models/Card";

/* ── RANG UNIQUE & PARTAGÉ ─────────────────────────────────────────── */

function splitCode(code: string) {
  const [raw, _] = code.split("_"); // raw = "7C", "10D", etc.
  const rank = raw.slice(0, -1); // Tout sauf le dernier caractère
  const suit = raw.slice(-1) as Suit; // Dernier caractère (C, D, H, S)
  return { rank, suit } as const;
}

export const useGameStore = defineStore("game", () => {
  /* ──────────── state ──────────── */
  const room = ref<RoomState | null>(null);
  const myUid = ref<string | null>(null);
  const hand = ref<string[]>([]);
  const melds = ref<Record<string, string[]>>({});
  const exchangeTable = ref<Record<string, string>>({});
  const scores = ref<Record<string, number>>({});

  const loading = ref(true);
  const drawInProgress = ref(false);
  const playing = ref(false); // verrou anti double‑clic
  const showExchange = ref(false);

  /* ──────────── getters ──────────── */

  watchEffect(() => {
    if (!room.value) return;
    console.log("drawQueue:", room.value.drawQueue);
  });

  const currentTurn = computed(() => room.value?.currentTurn ?? null);

  const getExchange = computed(() => exchangeTable.value);
  const getScore = (uid: string) => scores.value[uid] ?? 0;

  /* ─────────── helpers ─────────── */
  function _subscribeRoom(roomId: string) {
    return onSnapshot(doc(db, "rooms", roomId), (snap) => {
      loading.value = false;
      if (!snap.exists()) {
        room.value = null;
        return;
      }
      const data = snap.data() as RoomDoc;
      room.value = { id: snap.id, ...data };
      if (myUid.value) hand.value = data.hands?.[myUid.value] ?? [];
      // melds.value = { ...data.melds };
      exchangeTable.value = { ...(data.exchangeTable ?? {}) };
      scores.value = { ...(data.scores ?? {}) };
    });
  }

  async function updateHand(newHand: string[]) {
    if (!room.value || !myUid.value) return;
    await updateDoc(doc(db, "rooms", room.value.id), {
      [`hands.${myUid.value}`]: newHand,
    });
    hand.value = [...newHand];
  }

  /**
   * Déplace `code` de la main de `uid` vers sa meld.
   * - Déclenche la réactivité Vue 3 (nouveaux tableau + objet).
   * - Annule proprement en cas d'erreur Firestore.
   */
  function addToMeld(uid: string, code: string) {
    if (!room.value) return;
    if (!hand.value.includes(code)) return;

    // Mise à jour locale : on retire la carte de la main
    hand.value = hand.value.filter((c) => c !== code);

    // Et on l'ajoute au meld visible
    melds.value = {
      ...melds.value,
      [uid]: [...(melds.value[uid] ?? []), code],
    };
  }
  async function drawCard() {
    if (!canDraw.value || !room.value || !myUid.value) return;
    const roomRef = doc(db, "rooms", room.value.id);
    drawInProgress.value = true;

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) throw new Error("Room missing");
        const d = snap.data() as RoomDoc;

        if (d.drawQueue[0] !== myUid.value)
          throw new Error("Not your draw turn");

        const deck = [...d.deck];
        if (deck.length === 0) throw new Error("Deck empty");

        const card = deck.shift()!;
        const newHand = [...(d.hands[myUid.value] ?? []), card];

        // Mise à jour de la queue : si plus d’un joueur reste, on enlève le premier, sinon on garde la queue telle quelle
        const newQueue =
          d.drawQueue.length > 1 ? d.drawQueue.slice(1) : d.drawQueue;

        const update: Record<string, any> = {
          deck,
          [`hands.${myUid.value}`]: newHand,
          drawQueue: newQueue,
        };

        if (newQueue.length === 0) {
          update.currentTurn = d.currentTurn; // force le tour correct si plus personne à piocher
        }

        tx.update(roomRef, update);

        // mise à jour locale optimiste
        hand.value = newHand;
      });
    } finally {
      drawInProgress.value = false;
    }
  }

  function resolveTrick(
    first: string,
    second: string,
    firstUid: string,
    secondUid: string,
    trump: Suit
  ): string {
    const a = splitCode(first); // { rank, suit }
    const b = splitCode(second);
    // 1) même couleur → plus haute l’emporte
    if (a.suit === b.suit) {
      return RANK_ORDER[a.rank] >= RANK_ORDER[b.rank] ? firstUid : secondUid;
    }
    // 2) couleurs diff. : atout > non‑atout
    if (a.suit === trump && b.suit !== trump) return firstUid;
    if (b.suit === trump && a.suit !== trump) return secondUid;
    // 3) couleurs diff., pas d’atout → le meneur gagne
    return firstUid;
  }

  // delay utilitaire
  function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function playCard(code: string) {
    if (
      playing.value ||
      !room.value ||
      !myUid.value ||
      room.value.currentTurn !== myUid.value
    )
      return;

    playing.value = true;

    const roomRef = doc(db, "rooms", room.value.id);

    try {
      // 1ère transaction : poser la carte dans trick.cards
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) throw new Error("Room missing");
        const d = snap.data() as RoomDoc;

        if ((d.trick.cards?.length ?? 0) >= 2) throw new Error("Trick full");

        const srvHand = [...(d.hands[myUid.value] ?? [])];
        const pos = srvHand.indexOf(code);
        if (pos === -1) throw new Error("Card not in hand server");
        srvHand.splice(pos, 1);

        const cards = [...(d.trick.cards ?? []), code];
        const players = [...(d.trick.players ?? []), myUid.value];
        const opponent = d.players.find((p) => p !== myUid.value)!;

        const update: Record<string, any> = {
          [`hands.${myUid.value}`]: srvHand,
          trick: { cards, players },
          exchangeTable: { ...(d.exchangeTable ?? {}), [myUid.value]: code },
        };

        if (cards.length === 1) {
          update.currentTurn = opponent;
        } else {
          // On ne résout PAS encore ici !
          // Juste on garde la deuxième carte posée côté serveur
        }

        tx.update(roomRef, update);
      });

      // Maintenant on attend 3 secondes si on vient de poser la 2e carte
      if ((room.value.trick.cards?.length ?? 0) + 1 === 2) {
        // +1 car on vient de poser la carte mais la donnée room.value n'est pas encore mise à jour localement
        await delay(3000);
        await resolveTrickOnServer();
      }
    } finally {
      playing.value = false;
    }
  }

  async function resolveTrickOnServer() {
    if (!room.value) return;

    const roomRef = doc(db, "rooms", room.value.id);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room missing");
      const d = snap.data() as RoomDoc;

      const cards = d.trick.cards ?? [];
      const players = d.trick.players ?? [];
      if (cards.length !== 2) throw new Error("Trick not full");

      // Code pour déterminer le gagnant, points, etc (idem dans playCard)

      function getSuit(card: string): string {
        const [raw] = card.split("_");
        return raw.slice(-1);
      }
      const trumpSuit = getSuit(d.trumpCard);
      const winner = resolveTrick(
        cards[0],
        cards[1],
        players[0],
        players[1],
        trumpSuit
      );
      const loser = players.find((p) => p !== winner)!;

      const points = cards.reduce(
        (acc, c) => (["10", "A"].includes(splitCode(c).rank) ? acc + 10 : acc),
        0
      );

      const update: Record<string, any> = {
        trick: { cards: [], players: [] },
        exchangeTable: {},
        currentTurn: winner,
        drawQueue: [winner, loser],
      };

      if (points) {
        update[`scores.${winner}`] = (d.scores?.[winner] ?? 0) + points;
      }

      tx.update(roomRef, update);
    });
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

  function canDraw(): boolean {
    if (!room.value || !myUid.value) return false;

    const dq = room.value.drawQueue ?? [];
    const hasToDraw = dq[0] === myUid.value;

    const myHand = room.value.hands[myUid.value] ?? [];
    const myMeld = room.value.melds?.[myUid.value] ?? [];

    const cardCount = myHand.length + myMeld.length;
    const spaceAvailable = cardCount < 9;

    return hasToDraw && spaceAvailable;
  }

  function cancelExchange() {
    showExchange.value = false;
  }

  async function joinRoom(roomId: string, uid: string, playerName: string) {
    myUid.value = uid;

    /* 1️⃣ — transaction pour s’enregistrer — */
    const roomRef = doc(db, "rooms", roomId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room not found");
      const d = snap.data() as RoomDoc;

      /* déjà dedans → rien à faire */
      if (d.players.includes(uid)) return;

      /* salle pleine → refuse l’entrée  */
      if (d.players.length >= 2) throw new Error("Room already full");

      /* récupère la main réservée et prépare les updates */
      const seat2Hand = d.reservedHands?.seat2 ?? [];
      const updates: Record<string, any> = {
        players: [...d.players, uid],
        [`playerNames.${uid}`]: playerName,
        [`hands.${uid}`]: seat2Hand,
        [`scores.${uid}`]: 0,
      };

      /* dès qu’on est 2 on peut passer en phase 'play' */
      updates.currentTurn = d.currentTurn ?? d.players[0]; // ou tirage au sort

      tx.update(roomRef, updates);
    });

    /* 2️⃣ — s’abonner en temps réel — */
    return _subscribeRoom(roomId);
  }

  async function dropToMeld(code: string) {
    if (!room.value || !myUid.value) return;
    await addToMeld(myUid.value, code);
  }

  /** Préfixe "d'" ou "de " selon voyelle */
  const deOuD = (name: string) =>
    /^[aeiouyàâäéèëêïîôöùûüh]/i.test(name.trim()) ? "d'" : "de ";

  // helper facultatif
  const RANK_ORDER: Record<string, number> = {
    A: 8,
    "10": 7,
    K: 6,
    Q: 5,
    J: 4,
    "9": 3,
    "8": 2,
    "7": 1,
  };

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

    // getters
    canDraw,
    currentTurn,
    getExchange,

    // actions
    //getCombos,
    getScore,
    //getMeldArea,
    updateHand,
    addToMeld,
    playCard,
    drawCard,
    dropToMeld,
    joinRoom,
    deOuD,
    //getMeld,
    resolveTrick,
    confirmExchange,
    //applyCombo,
    //getMeldTags,
  };
});
