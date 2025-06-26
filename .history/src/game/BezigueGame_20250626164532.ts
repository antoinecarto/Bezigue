



type Suit = '♠' | '♥' | '♦' | '♣';
type Rank = '7' | '8' | '9' | 'J' | 'Q' | 'K' | '10' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export interface Combination {
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




/* -------- détection -------- */
export function detectCombinations(all: Card[], trump: Suit): Combination[] {
  const combos: Combination[] = [];
  const byRank: Record<Rank, Card[]> =
    { '7':[], '8':[], '9':[], '10':[], 'J':[], 'Q':[], 'K':[], 'A':[] };
  all.forEach(c => byRank[c.rank].push(c));

  /* 4-As, 4-Rois, 4-Dames, 4-Valets */
  const fourMap = { A:100, K:80, Q:60, J:40 } as const;
  (['A','K','Q','J'] as Rank[]).forEach(r => {
    if (byRank[r].length >= 4) combos.push({ name:`4 ${r}`, points: fourMap[r], cards: byRank[r].slice(0,4) });
  });

  /* mariages */
  ['♠','♥','♦','♣'].forEach(s => {
    const king = all.find(c => c.rank==='K' && c.suit===s);
    const queen= all.find(c => c.rank==='Q' && c.suit===s);
    if (king && queen) {
      const atout = s === trump ? ' d’atout' : '';
      combos.push({ name:`Mariage ${s}${atout}`, points: s===trump?40:20, cards:[king,queen]});
    }
  });

  /* suite J-Q-K-10-A */
  ['♠','♥','♦','♣'].forEach(s => {
    const suite = ['J','Q','K','10','A'].map(r => all.find(c => c.rank===r && c.suit===s));
    if (suite.every(Boolean)) {
      const atout = s === trump ? ' d’atout' : '';
      combos.push({ name:`Suite ${s}${atout}`, points: s===trump?250:150, cards: suite as Card[]});
    }
  });

  /* Dame ♠ + Valet ♦ (et doublon) */
  const qs = all.filter(c => c.rank==='Q' && c.suit==='♠');
  const jd = all.filter(c => c.rank==='J' && c.suit==='♦');
  const pairs = Math.min(qs.length, jd.length);
  if (pairs>=1) combos.push({ name:'Dame♠+Valet♦', points:40, cards:[qs[0],jd[0]]});
  if (pairs>=2) combos.push({ name:'2×(Dame♠+Valet♦)', points:500, cards:[qs[0],jd[0],qs[1],jd[1]]});

  /* 7 d’atout */
  const sevenTrump = all.find(c => c.rank==='7' && c.suit===trump);
  if (sevenTrump) combos.push({ name:'7 d’atout', points:10, cards:[sevenTrump] });

  return combos;
}
