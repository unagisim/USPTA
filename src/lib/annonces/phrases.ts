// Catalogue des formulations d'une langue. Le français est la langue de la V1 ;
// l'anglais s'ajoutera en écrivant un second catalogue, sans toucher au moteur.

import type { ConductLevel, TimeLevel } from '../engine';

export interface Phrases {
  /** Score dans un jeu, serveur en premier : « 15-0 », « 30 partout ». */
  pointScore(server: string, receiver: string): string;
  pointsAll(label: string): string;
  /** Première égalité du jeu : « 40 A ». */
  fortyAll: string;
  /** Égalités suivantes. */
  deuce: string;
  decidingPoint: string;
  advantage(name: string): string;
  /** Jeu décisif : « 2-1 Djokovic », « 1-1 ». */
  tiebreakLead(hi: number, lo: number, name: string): string;
  tiebreakAll(n: number): string;

  /** Fin de jeu en une phrase : « Jeu X, X mène 2 jeux à 1. » */
  game(name: string, score: string): string;
  /** « premier jeu », « premier jeu, deuxième manche » ; `set` vide pour la première manche. */
  firstGame(set: string): string;
  gamesLead(name: string, hi: number, lo: number): string;
  gamesAll(n: number): string;
  /** « Au service Mme Kerber », après le changement de côté du premier jeu. */
  serving(name: string): string;
  /** « 6 jeux partout première manche, jeu décisif ». */
  gamesAllTiebreak(n: number, set: string): string;
  /** « première manche », « deuxième manche », « dernière manche ». */
  setName(n: number, last: boolean): string;
  /** « Jeu et deuxième manche X, 7 jeux à 6, une manche partout. » */
  setWon(set: string, name: string, hi: number, lo: number, setsAll: boolean, superTiebreak: boolean): string;
  /** « Jeu, set et match Mlle Stephens 2 manches à 1, 1/6-6/2-7/5 ». */
  matchWon(name: string, won: number, lost: number, scores: string[]): string;
  /** Fin anticipée : « Mesdames, messieurs, M. X est contraint d'abandonner, jeu set et match Y 6/3 1/0. » */
  matchEnd(
    loser: string,
    feminine: boolean,
    winner: string,
    reason: 'retirement' | 'disqualification' | 'walkover',
    scores: string[],
  ): string;
  /** Début d'une interruption (pluie, nuit…). */
  interrupted: string;

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
  fortyAll: '40 A',
  deuce: 'Égalité',
  decidingPoint: '40 A, point décisif, choix au relanceur',
  advantage: (n) => `Avantage ${n}`,
  tiebreakLead: (hi, lo, n) => `${hi}-${lo} ${n}`,
  tiebreakAll: (n) => `${n}-${n}`,

  game: (n, score) => `Jeu ${n}, ${score}.`,
  firstGame: (set) => (set ? `premier jeu, ${set}` : 'premier jeu'),
  gamesLead: (n, hi, lo) => `${n} mène ${hi} ${jeux(hi)} à ${lo}`,
  gamesAll: (n) => `${n} partout`,
  serving: (n) => `Au service ${n}`,
  gamesAllTiebreak: (n, set) => `${n} ${jeux(n)} partout ${set}, jeu décisif`,
  setName: (n, last) => (last ? 'dernière manche' : `${ORDINALS[n - 1] ?? `${n}e`} manche`),
  setWon: (set, n, hi, lo, all, stb) =>
    `Jeu et ${set} ${n}, ${hi} ${jeux(hi)} à ${lo}${all ? ', une manche partout' : ''}${stb ? ', super jeu décisif' : ''}.`,
  matchWon: (n, won, lost, scores) => `Jeu, set et match ${n} ${won} manches à ${lost}, ${scores.join('-')}`,
  matchEnd: (loser, fem, winner, reason, scores) => {
    if (reason === 'walkover') return `Victoire de ${winner} par forfait`;
    const e = fem ? 'e' : '';
    const what = reason === 'retirement' ? `est contraint${e} d'abandonner` : `est disqualifié${e}`;
    return `Mesdames, messieurs, ${loser} ${what}, jeu set et match ${[winner, ...scores].join(' ')}.`;
  },
  interrupted: 'Mesdames, messieurs, la partie est interrompue',

  fault: 'Faute',
  netFault: 'Filet, faute',
  netFirst: 'Filet, premier service',
  netSecond: 'Filet, deuxième service',
  rallyLet: 'Let',

  // Motif, étape, nom ; à la dernière étape, le juge-arbitre est appelé (annonce suivante).
  conduct: (o, l, n) => {
    const motif = o.charAt(0).toLowerCase() + o.slice(1);
    return l === 'disqualification'
      ? `Violation du code de conduite, ${motif}, ${n}`
      : `Violation du code de conduite, ${motif}, ${CONDUCT_FR[l]}, ${n}`;
  },
  timeViolation: (l, n) => `Dépassement de temps, ${l === 'warning' ? 'avertissement' : 'point de pénalité'}, ${n}`,
  callReferee: 'Le Juge-Arbitre a été appelé sur le court',

  newBalls: 'Balles neuves',
  time: 'Time',
};
