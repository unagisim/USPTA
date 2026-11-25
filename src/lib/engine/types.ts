// Types du moteur de règles. Identifiants en anglais, libellés affichés en français.

export type Side = 'A' | 'B';

export const other = (s: Side): Side => (s === 'A' ? 'B' : 'A');

export interface Pair {
  A: number;
  B: number;
}

export type FormatId = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7';

export interface MatchFormat {
  id: FormatId;
  label: string;
  description: string;
  /** Sets à gagner (2 pour tous les formats FFT). */
  setsToWin: number;
  /** Jeux pour gagner un set, avec 2 jeux d'écart. */
  gamesPerSet: number;
  /** Égalité de jeux qui déclenche le jeu décisif (6 pour 6-6). */
  tiebreakAt: number;
  tiebreakPoints: number;
  /** Le set décisif est remplacé par un super jeu décisif. */
  finalSetSuperTiebreak: boolean;
  superTiebreakPoints: number;
  /** Point décisif à 40-40, au choix du relanceur. */
  decidingPoint: boolean;
}

/** Option balles neuves. */
export type BallChange =
  | { mode: 'none' }
  /**
   * Changement après `first` jeux, puis tous les `every` jeux. L'échauffement compte pour
   * `warmupGames` jeux (2 en règle générale, 0 pour ne pas le compter).
   */
  | { mode: 'regulation'; first: number; every: number; warmupGames: number }
  /** Balles neuves pour le 3e set (ou le super jeu décisif). */
  | { mode: 'final_set' };

export interface MatchConfig {
  format: MatchFormat;
  firstServer: Side;
  /** Joueur placé à gauche de la chaise au début du match. */
  leftAtStart: Side;
  balls: BallChange;
}

export type Civility = 'M.' | 'Mme' | 'Mlle';

export interface Player {
  civility: Civility;
  firstName: string;
  lastName: string;
  club?: string;
  ranking?: string;
  licence?: string;
}

// ---- Événements : le match est stocké comme une liste d'événements horodatés ----

interface Base {
  /** Identifiant unique et croissant dans le match. */
  id: number;
  /** Horodatage automatique (ms). */
  ts: number;
}

/** Annonce au service : faute, filet puis faute, filet (balle à rejouer), ace. */
export type ServeCall = 'fault' | 'net_fault' | 'net' | 'ace';

export interface ServeEvent extends Base {
  kind: 'serve';
  call: ServeCall;
}

/** Point gagné pendant l'échange (balle faute de l'adversaire, coup gagnant…). */
export interface PointEvent extends Base {
  kind: 'point';
  winner: Side;
}

/** « Let » pendant l'échange : le point est rejoué avec deux services. */
export interface LetEvent extends Base {
  kind: 'let';
}

export interface ConductEvent extends Base {
  kind: 'conduct';
  player: Side;
  /** Infraction, libellé tiré de la liste modifiable des réglages. */
  offence: string;
  note?: string;
}

export interface TimeViolationEvent extends Base {
  kind: 'time_violation';
  player: Side;
  note?: string;
}

export type TimerKind = 'warmup' | 'medical' | 'toilet' | 'interruption';

export interface TimerEvent extends Base {
  kind: 'timer';
  timer: TimerKind;
  action: 'start' | 'stop';
  player?: Side;
}

/** Début du jeu (« Time » après l'échauffement). */
export interface StartEvent extends Base {
  kind: 'start';
}

export type EndType = 'retirement' | 'disqualification' | 'walkover';

export interface EndEvent extends Base {
  kind: 'end';
  type: EndType;
  loser: Side;
  note?: string;
}

export interface NoteEvent extends Base {
  kind: 'note';
  text: string;
}

// ---- Corrections : jamais d'effacement, chaque correction est un événement tracé ----

/** Annule un événement (le dernier point, en général). */
export interface UndoEvent extends Base {
  kind: 'undo';
  target: number;
  reason?: string;
}

/** Contenu de remplacement d'un événement de jeu (overrule, point à rejouer, vainqueur corrigé). */
export type Replacement =
  | { kind: 'serve'; call: ServeCall }
  | { kind: 'point'; winner: Side }
  | { kind: 'let' };

export interface ReplaceEvent extends Base {
  kind: 'replace';
  target: number;
  with: Replacement;
  reason?: string;
}

/** Erreur de service découverte : on rétablit le bon serveur, les points joués restent acquis. */
export interface SetServerEvent extends Base {
  kind: 'set_server';
  server: Side;
  reason?: string;
}

/** Score fixé à la main, en dernier recours. */
export interface AdjustEvent extends Base {
  kind: 'adjust';
  /** Sets terminés (un super jeu décisif gagné s'écrit 1-0 ou 0-1). */
  sets: Pair[];
  games: Pair;
  points: Pair;
  server: Side;
  reason?: string;
}

export type MatchEvent =
  | ServeEvent
  | PointEvent
  | LetEvent
  | ConductEvent
  | TimeViolationEvent
  | TimerEvent
  | StartEvent
  | EndEvent
  | NoteEvent
  | UndoEvent
  | ReplaceEvent
  | SetServerEvent
  | AdjustEvent;

/** Événement sans identifiant ni horodatage, tel que saisi par l'arbitre. */
export type EventInput = MatchEvent extends infer E ? (E extends MatchEvent ? Omit<E, 'id' | 'ts'> : never) : never;
