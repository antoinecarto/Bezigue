export interface CardData {
  /** Chaîne brute “As♠”, “10♥”… */
  raw: string
  rank: number          // 7-14  (7,8,9,10,11=Valet,12=Dame,13=Roi,14=As)
  suit: string          // '♠','♣','♥','♦'
}

/**
 * Décode “10♥” → { raw:'10♥', rank:10, suit:'♥' }
 * (adapte si tu utilises une autre notation)
 */
export function parseCard(raw: string): CardData {
  const suit = raw.slice(-1)
  const rankStr = raw.slice(0, -1)
  const rankTable: Record<string, number> = { V: 10, D: 11, R: 12, 10: 13, A: 14 }
  const rank = Number(rankStr) || rankTable[rankStr] || 0
  return { raw, rank, suit }
}

/**
 * Renvoie l’uid du vainqueur (‘firstUid’ ou ‘secondUid’)
 * Règles : voir énoncé utilisateur.
 */
export function resolveTrick(
  firstCard: string,
  secondCard: string,
  firstUid: string,
  secondUid: string,
  trumpSuit: string
): string {
  const A = parseCard(firstCard)
  const B = parseCard(secondCard)

  const trumpA = A.suit === trumpSuit
  const trumpB = B.suit === trumpSuit

  if (A.suit === B.suit) {
    return A.rank >= B.rank ? firstUid : secondUid
  }
  if (trumpA && !trumpB) return firstUid
  if (!trumpA && trumpB) return secondUid
  if (trumpA && trumpB) return A.rank >= B.rank ? firstUid : secondUid
  // couleurs différentes, pas d’atout : premier joueur gagne
  return firstUid
}

/* -------- types -------- */
type Suit = '♠' | '♥' | '♦' | '♣';
type Rank = '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
interface Card { rank: Rank; suit: Suit }
interface Combination { name: string; points: number; cards: Card[] }

/* -------- aide -------- */
const order: Rank[] = ['7','8','9','J','Q','K','10','A'];
const isTrump = (card: Card, trump: Suit) => card.suit === trump;

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

