



type Suit = '♠' | '♥' | '♦' | '♣';
type Rank = '7' | '8' | '9' | 'J' | 'Q' | 'K' | '10' | 'A';

interface Card {
  suit: Suit;
  rank: Rank;
}

interface Combination {
  name: string;
  cards: Card[];
  points: number;
}

//


// Fonction pour distribuer les deux jeux de 32 cartes et connaître l'atout
export function distributeCards(deck: string[]) {
  const player1Hand = deck.slice(0, 8);
  const player2Hand = deck.slice(8, 16);
  const drawPile    = deck.slice(16);
  const trumpCard   = drawPile[0];          // ex. 21ᵉ carte

  return {
    hands: {
      player1: player1Hand,
      player2: player2Hand,
    },
    trumpCard,
    drawPile,
  };
}

// Fonction pour générer un jeu mélangé
export function generateShuffledDeck() {
  const suits = ['♠', '♥', '♦', '♣']
  const ranks = ['7', '8', '9', 'J', 'Q', 'K' ,'10', 'A']
  let deck = []

  // Générer un jeu complet (32 cartes)
  const singleDeck = []
  for (const suit of suits) {
    for (const rank of ranks) {
      singleDeck.push(rank + suit)
    }
  }

  // Concaténer deux jeux identiques
  deck = singleDeck.concat(singleDeck)

  // Mélange du deck (Fisher-Yates)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }

  return deck
}


export default class BezigueGame {
  deck: Card[] = [];
  player1Hand: Card[] = [];
  player2Hand: Card[] = [];
  trumpCard: Card | null = null;
  drawPile: Card[] = [];

  constructor() {
    // this.initializeDeck();
    // this.shuffleDeck();
    // this.dealCards();
  }

  //


  //

  // initializeDeck() {
  //   const suits: Suit[] = ['♠', '♥', '♦', '♣'];
  //   const ranks: Rank[] = ['7', '8', '9', 'J', 'Q', 'K', '10', 'A'];

  //   this.deck = [];
  //   for (let i = 0; i < 2; i++) {  // double deck
  //     for (const suit of suits) {
  //       for (const rank of ranks) {
  //         this.deck.push({ suit, rank });
  //       }
  //     }
  //   }
  // }

  // shuffleDeck() {
  //   for (let i = this.deck.length - 1; i > 0; i--) {
  //     const j = Math.floor(Math.random() * (i + 1));
  //     [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
  //   }
  // }



  // drawCard(player: 1 | 2): Card | null {
  //   if (this.drawPile.length === 0) return null;
  //   const card = this.drawPile.shift()!;
  //   if (player === 1) {
  //     this.player1Hand.push(card);
  //   } else {
  //     this.player2Hand.push(card);
  //   }
  //   return card;
  // }

  // playCard(player: 1 | 2, card: Card): boolean {
  //   let hand = player === 1 ? this.player1Hand : this.player2Hand;
  //   const index = hand.findIndex(c => c.rank === card.rank && c.suit === card.suit);
  //   if (index === -1) return false; // carte non trouvée dans la main
  //   hand.splice(index, 1);
  //   // Ici, tu peux gérer la logique du pli actuel
  //   return true;
  // }

  isGameOver(): boolean {
    return this.player1Hand.length === 0 && this.player2Hand.length === 0 && this.drawPile.length === 0;
  }

  // Exemple simplifié pour détecter certaines combinaisons
 getPossibleCombinations(cards: Card[]): Combination[] {
  const combos: Combination[] = [];

  // Un set "used" par catégorie de combinaisons
  const usedCardsInQuads = new Set<string>();
  const usedCardsInMarriages = new Set<string>();
  const usedCardsInSuites = new Set<string>();
  const usedCardsInDameValet = new Set<string>();

  const getCardKey = (card: Card) => `${card.suit}${card.rank}`;

  const isCardUsedIn = (card: Card, usedSet: Set<string>) => usedSet.has(getCardKey(card));
  const markCardsUsedIn = (comboCards: Card[], usedSet: Set<string>) => {
    comboCards.forEach(card => usedSet.add(getCardKey(card)));
  };

  // Regrouper les cartes par rang
  const countByRank: Record<Rank, Card[]> = {
    '7': [], '8': [], '9': [], 'J': [], 'Q': [], 'K': [], '10': [], 'A': [],
  };
  cards.forEach(c => countByRank[c.rank].push(c));

  // Combinaisons de 4 cartes du même rang
  const ranksToCheck = ['A', 'K', 'Q', 'J'] as Rank[];
  const pointsMap = { 'A': 100, 'K': 80, 'Q': 60, 'J': 40 };
  for (const rank of ranksToCheck) {
    const available = countByRank[rank].filter(c => !isCardUsedIn(c, usedCardsInQuads));
    while (available.length >= 4) {
      const group = available.splice(0, 4);
      combos.push({
        name: `Quatre ${rank}s`,
        cards: group,
        points: pointsMap[rank],
      });
      markCardsUsedIn(group, usedCardsInQuads);
    }
  }

  // Couples Roi-Dame (simples et atout)
for (const suit of ['♠', '♥', '♦', '♣'] as Suit[]) {
  const kings = cards.filter(c => c.rank === 'K' && c.suit === suit && !isCardUsedIn(c, usedCardsInMarriages));
  const queens = cards.filter(c => c.rank === 'Q' && c.suit === suit && !isCardUsedIn(c, usedCardsInMarriages));
  
  const minCount = Math.min(kings.length, queens.length);

  for (let i = 0; i < minCount; i++) {
    const king = kings[i];
    const queen = queens[i];

    // Vérification supplémentaire (normalement implicite, mais sécurité)
    if (king.suit !== queen.suit) continue;

    const isTrump = this.trumpCard?.suit === suit;

    const combo = {
      cards: [king, queen],
      points: isTrump ? 40 : 20,
    };

    combos.push(combo); // Tu affiches combo.cards dans l’UI
    markCardsUsedIn(combo.cards, usedCardsInMarriages);
  }
}


  // Suites valet-dame-roi-10-As
  const suiteRanks: Rank[] = ['J', 'Q', 'K', '10', 'A'];
  for (const suit of ['♠', '♥', '♦', '♣'] as Suit[]) {
    const suiteCards = suiteRanks.map(rank =>
      cards.find(c => c.suit === suit && c.rank === rank && !isCardUsedIn(c, usedCardsInSuites))
    );
    if (suiteCards.every(Boolean)) {
      const validCards = suiteCards as Card[];
      const isTrump = this.trumpCard?.suit === suit;
      combos.push({
        name: isTrump
          ? `Suite valet dame roi dix As d'atout (${suit})`
          : `Suite valet dame roi dix As (${suit})`,
        cards: validCards,
        points: isTrump ? 250 : 150,
      });
      markCardsUsedIn(validCards, usedCardsInSuites);
    }
  }

  // Dame de pique + Valet de carreau
  const queensSpades = cards.filter(c => c.suit === '♠' && c.rank === 'Q' && !isCardUsedIn(c, usedCardsInDameValet));
  const jacksDiamonds = cards.filter(c => c.suit === '♦' && c.rank === 'J' && !isCardUsedIn(c, usedCardsInDameValet));
  const minPairs = Math.min(queensSpades.length, jacksDiamonds.length);
  for (let i = 0; i < minPairs; i++) {
    const combo = {
      name: `Dame de pique, Valet de carreau`,
      cards: [queensSpades[i], jacksDiamonds[i]],
      points: 40,
    };
    combos.push(combo);
    markCardsUsedIn(combo.cards, usedCardsInDameValet);
  }

  return combos;
}

}
