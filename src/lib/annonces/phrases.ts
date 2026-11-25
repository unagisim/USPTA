// Catalogue des formulations d'une langue. Le français est la langue de la V1 ;
// l'anglais s'ajoutera en écrivant un second catalogue, sans toucher au moteur.

import type { ConductLevel, TimeLevel } from '../engine';

export interface Phrases {
  /** Score dans un jeu, serveur en premier : « 15-0 », « 30 partout ». */
  pointScore(server: string, receiver: string): string;
  pointsAll(label: string): string;
  deuce: string;
  decidingPoint: string;
  advantage(name: string): string;
  /** Jeu décisif : « 3-2 M. Paul Dupont », « 3 partout ». */
  tiebreakLead(hi: number, lo: number, name: string): string;
  tiebreakAll(n: number): string;

  game(name: string): string;
  gamesLead(name: string, hi: number, lo: number, setOrdinal: string): string;
  gamesAll(n: number, setOrdinal: string): string;
  gamesAllTiebreak(n: number): string;
  setWon(setOrdinal: string, name: string, hi: number, lo: number): string;
  setsAllSuperTiebreak: string;
  matchWon(name: string, scores: string[]): string;
  matchEnd(name: string, reason: 'retirement' | 'disqualification' | 'walkover'): string;
  ordinal(n: number): string;

  fault: string;
  netFault: string;
  netFirst: string;
  netSecond: string;
  rallyLet: string;

  conduct(offence: string, level: ConductLevel, name: string): string;
  timeViolation(level: TimeLevel, name: string): string;
  callReferee: string;

  newBalls: string;
  time: string;
}

const ORDINALS = ['première', 'deuxième', 'troisième', 'quatrième', 'cinquième'];
const jeux = (n: number) => (n > 1 ? 'jeux' : 'jeu');

const CONDUCT_FR: Record<ConductLevel, string> = {
  warning: 'avertissement',
  point: 'point de pénalité',
  three_points: 'trois points de pénalité',
  disqualification: 'disqualification',
};

export const fr: Phrases = {
  pointScore: (s, r) => `${s}-${r}`,
  pointsAll: (l) => `${l} partout`,
  deuce: 'Égalité',
  decidingPoint: 'Point décisif, choix du relanceur',
  advantage: (n) => `Avantage ${n}`,
  tiebreakLead: (hi, lo, n) => `${hi}-${lo} ${n}`,
  tiebreakAll: (n) => `${n} partout`,

  game: (n) => `Jeu ${n}.`,
  gamesLead: (n, hi, lo, o) => `${n} mène ${hi} ${jeux(hi)} à ${lo}, ${o} manche`,
  gamesAll: (n, o) => `${n} ${jeux(n)} partout, ${o} manche`,
  gamesAllTiebreak: (n) => `${n} ${jeux(n)} partout, jeu décisif`,
  setWon: (o, n, hi, lo) => `Jeu et ${o} manche ${n}, ${hi} ${jeux(hi)} à ${lo}`,
  setsAllSuperTiebreak: 'Une manche partout, super jeu décisif',
  matchWon: (n, scores) => `Jeu, manche et match ${n}, ${scores.join(' ')}`,
  matchEnd: (n, reason) =>
    `Victoire de ${n} par ${reason === 'retirement' ? 'abandon' : reason === 'disqualification' ? 'disqualification' : 'forfait'}`,
  ordinal: (n) => ORDINALS[n - 1] ?? `${n}e`,

  fault: 'Faute',
  netFault: 'Filet, faute',
  netFirst: 'Filet, premier service',
  netSecond: 'Filet, deuxième service',
  rallyLet: 'Let',

  conduct: (o, l, n) => `Infraction au code de conduite, ${o}, ${CONDUCT_FR[l]}, ${n}`,
  timeViolation: (l, n) => `Dépassement de temps, ${l === 'warning' ? 'avertissement' : 'point de pénalité'}, ${n}`,
  callReferee: 'Appeler le juge-arbitre',

  newBalls: 'Balles neuves',
  time: 'Time',
};
