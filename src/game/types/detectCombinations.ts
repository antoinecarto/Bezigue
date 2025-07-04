/* detectCombinations.ts
   ------------------------------------------------------------------ */
import type { Card, Rank, Suit } from "./Card";

/* ------------ Types retournés ------------------------------------- */
export interface Combination {
  name: string;
  points: number;
  cards: Card[];
}

/* ------------ Constantes utiles ---------------------------------- */
const allSuits: Suit[] = ["♠", "♥", "♦", "♣"];
const fourBaseScore: Record<Rank, number> = {
  A: 100,
  K: 80,
  Q: 60,
  J: 40,
  "10": 0,
  "9": 0,
  "8": 0,
  "7": 0,
};

/* ------------------------------------------------------------------ */
/*  Gestion de l’utilisation des cartes                               */
/* ------------------------------------------------------------------ */
type UsageFlags = { marriage?: true; sequence?: true };
type UsedMap = Map<string, UsageFlags>;

const cardKey = (c: Card) => `${c.rank}${c.suit}`;

const hasFlag = (used: UsedMap, c: Card, flag: keyof UsageFlags) =>
  used.get(cardKey(c))?.[flag] === true;

const addFlag = (used: UsedMap, cards: Card[], flag: keyof UsageFlags) => {
  for (const c of cards) {
    const k = cardKey(c);
    const entry = used.get(k) ?? {};
    entry[flag] = true;
    used.set(k, entry);
  }
};

/* → Enregistre les combinaisons déjà posées                           */
const seedUsedMap = (used: UsedMap, existing: Combination[]) => {
  for (const comb of existing) {
    const flag = comb.name.startsWith("Mariage") ? "marriage" : "sequence";
    addFlag(used, comb.cards, flag);
  }
};

/* ------------------------------------------------------------------ */
/*  Fonction principale                                               */
/* ------------------------------------------------------------------ */
export function detectCombinations(
  hand: Card[],
  meld: Card[],
  trump: Suit,
  existing: Combination[] = []
): Combination[] {
  /* ------------------------------------------------------------ */
  /* 1.  Structures de travail                                    */
  /* ------------------------------------------------------------ */
  const proposals: Combination[] = [];
  const used: UsedMap = new Map();
  seedUsedMap(used, existing);

  const pool = [...hand, ...meld]; // toutes les cartes disponibles

  /* ------------------------------------------------------------ */
  /* 2.  DÉTECTION DES CARRÉS (4 cartes même rang)                */
  /* ------------------------------------------------------------ */
  (["A", "K", "Q", "J"] as Rank[]).forEach((rank) => {
    const rankCards = pool.filter((c) => c.rank === rank);
    if (rankCards.length < 4) return;

    const alreadyPosed = existing.some((c) => c.name === `4 ${rank}`);

    // Séparation cartes “neuves” vs déjà dans la famille sequence
    const fresh = rankCards.filter((c) => !hasFlag(used, c, "sequence"));
    const reused = rankCards.filter((c) => hasFlag(used, c, "sequence"));

    // Règle « 3 cartes neuves mini »
    if (fresh.length < 3) return;
    if (fresh.length + reused.length < 4) return;

    // Choix des 4 cartes : 3 neuves + (0‒1) réutilisée
    const selected =
      fresh.length >= 4 ? fresh.slice(0, 4) : [...fresh, reused[0]];

    // Si un même carré existe déjà, il faut en plus 3 cartes neuves **en main**
    if (alreadyPosed) {
      const freshInHand = hand.filter(
        (c) => c.rank === rank && !hasFlag(used, c, "sequence")
      ).length;
      if (freshInHand < 3) return;
    }

    proposals.push({
      name: `4 ${rank}`,
      points: fourBaseScore[rank],
      cards: selected,
    });
    addFlag(used, selected, "sequence");
  });

  /* ------------------------------------------------------------ */
  /* 3.  SUITES (5 cartes J‑Q‑K‑10‑A même couleur) + MARIAGES      */
  /* ------------------------------------------------------------ */
  for (const suit of allSuits) {
    /* objets rapides */
    const king = pool.find(
      (c) => c.rank === "K" && c.suit === suit && !hasFlag(used, c, "marriage")
    );
    const queen = pool.find(
      (c) => c.rank === "Q" && c.suit === suit && !hasFlag(used, c, "marriage")
    );

    const marriagePosed = existing.some(
      (c) =>
        c.name.startsWith("Mariage") &&
        c.cards.some((cc) => cc.rank === "K" && cc.suit === suit)
    );

    /* ----- SUITE --------------------------------------------- */
    const ranksNeeded: Rank[] = ["J", "Q", "K", "10", "A"];
    const suiteCards = ranksNeeded
      .map((r) =>
        pool.find(
          (c) =>
            c.rank === r && c.suit === suit && !hasFlag(used, c, "sequence")
        )
      )
      .filter(Boolean) as Card[];

    const suitePosed = existing.some(
      (c) =>
        c.name.startsWith("Suite") && c.cards.some((cc) => cc.suit === suit)
    );

    if (suiteCards.length === 5 && !suitePosed) {
      proposals.push({
        name: `Suite ${suit}${suit === trump ? " d’atout" : ""}`,
        points: suit === trump ? 250 : 150,
        cards: suiteCards,
      });
      addFlag(used, suiteCards, "sequence");
    }

    /* ----- MARIAGE ------------------------------------------- */
    if (!marriagePosed && king && queen) {
      proposals.push({
        name: `Mariage ${suit}${suit === trump ? " d’atout" : ""}`,
        points: suit === trump ? 40 : 20,
        cards: [king, queen],
      });
      addFlag(used, [king, queen], "marriage");
    }
  }

  /* ------------------------------------------------------------ */
  /* 4.  DAME♠ + VALET♦ (inchangé)                                */
  /* ------------------------------------------------------------ */
  const qsFree = pool.filter(
    (c) =>
      c.rank === "Q" &&
      c.suit === "♠" &&
      !hasFlag(used, c, "sequence") &&
      !hasFlag(used, c, "marriage")
  );
  const jdFree = pool.filter(
    (c) =>
      c.rank === "J" &&
      c.suit === "♦" &&
      !hasFlag(used, c, "sequence") &&
      !hasFlag(used, c, "marriage")
  );
  const pairsFree = Math.min(qsFree.length, jdFree.length);

  const alreadyPosedPairs = existing.filter((c) =>
    c.name.startsWith("Dame♠")
  ).length; // 0,1 ou 2

  const canPropose = Math.min(2 - alreadyPosedPairs, pairsFree);

  for (let i = 0; i < canPropose; i++) {
    // si deux paires dispo → on propose d’abord 500 pts, sinon 40
    if (canPropose === 2 && i === 0) {
      const cards = [qsFree[0], jdFree[0], qsFree[1], jdFree[1]];
      proposals.push({ name: "2×(Dame♠+Valet♦)", points: 500, cards });
      addFlag(used, cards, "sequence"); // on bloque entièrement
      i++; // on saute un cran
    } else {
      const cards = [qsFree[i], jdFree[i]];
      proposals.push({ name: "Dame♠+Valet♦", points: 40, cards });
      addFlag(used, cards, "sequence");
    }
  }

  /* ------------------------------------------------------------ */
  /* 5.  Résultat                                                 */
  /* ------------------------------------------------------------ */
  return proposals;
}
