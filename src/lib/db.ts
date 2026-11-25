// Stockage local (IndexedDB via Dexie). Un match est enregistré avec sa liste d'événements,
// à chaque saisie ; le score est toujours recalculé par le moteur.

import Dexie, { type EntityTable } from 'dexie';
import type { PlayerColor } from './colors';
import {
  DEFAULT_DURATIONS,
  FORMATS,
  type BallChange,
  type Durations,
  type FormatId,
  type MatchConfig,
  type MatchEvent,
  type Player,
  type Side,
} from './engine';

export interface MatchInfo {
  tournament: string;
  round: string;
  court: string;
  referee: string;
  umpire: string;
  umpireLicence: string;
  /** Match par équipes : le score s'annonce avec le nom du club. */
  team?: boolean;
  /** Surface du court : la terre battue a sa procédure (marques de balle). */
  surface?: Surface;
  lineJudges?: boolean;
  ballKids?: boolean;
}

export type Surface = 'clay' | 'hard' | 'synthetic' | 'carpet' | 'grass';
export const SURFACES: [Surface, string][] = [
  ['clay', 'Terre battue'],
  ['hard', 'Surface dure'],
  ['synthetic', 'Gazon synthétique'],
  ['carpet', 'Moquette'],
  ['grass', 'Gazon'],
];

import type { TossChoice } from './annonces/presentation';
export type { TossChoice };

export type CoinFace = 'heads' | 'tails';

/** Tirage fait avec la pièce de l'application : qui a annoncé, quoi, et le résultat. */
export interface CoinToss {
  caller: Side;
  call: CoinFace;
  result: CoinFace;
}

export interface Toss {
  winner: Side;
  /** Choix du gagnant ; null tant qu'il ne l'a pas fait. */
  choice: TossChoice | null;
  coin?: CoinToss;
}

/** setup : saisie ; prematch : contrôles, tirage, échauffement ; live : match ; finished : terminé. */
export type Phase = 'prematch' | 'live' | 'finished';

export interface StoredMatch {
  id: string;
  createdAt: number;
  updatedAt: number;
  info: MatchInfo;
  /** En double, `players` est le premier joueur de chaque équipe, `partners` le second. */
  players: { A: Player; B: Player };
  doubles?: boolean;
  partners?: { A: Player; B: Player };
  /** Double : joueur de chaque équipe qui sert en premier dans la première manche. */
  serveOrder?: Record<Side, 0 | 1>;
  /** Double : relanceur côté droit de chaque équipe dans la première manche. */
  receiveOrder?: Record<Side, 0 | 1>;
  formatId: FormatId;
  balls: BallChange;
  firstServer: Side;
  leftAtStart: Side;
  toss: Toss | null;
  /** Couleur de chaque joueur, d'après sa tenue. */
  colors?: Record<Side, PlayerColor>;
  /** Étapes cochées de la procédure guidée. */
  checklist: Record<string, boolean>;
  events: MatchEvent[];
  phase: Phase;
  winner: Side | null;
}

import type { NameFormat } from './annonces/announce';
export type { NameFormat };
export type Theme = 'auto' | 'light' | 'dark' | 'sun';

export interface Settings {
  id: 'settings';
  offences: string[];
  durations: Durations;
  sound: boolean;
  vibrate: boolean;
  /** Forme des noms à l'écran et dans la présentation. */
  nameFormat: NameFormat;
  /** Civilité (M., Mme, Mlle) devant les noms à l'écran. */
  civility: boolean;
  theme: Theme;
}

/** Motifs d'application du code de conduite FFT. */
export const DEFAULT_OFFENCES = [
  'Jet de balle',
  'Jet de raquette',
  'Grossièreté audible',
  'Insulte',
  'Geste obscène',
  'Agression physique',
  'Coaching',
  'Dépassement de temps intentionnel',
  'Comportement antisportif',
];

/** Première liste livrée, remplacée par la liste FFT si l'arbitre ne l'a pas modifiée. */
const OLD_OFFENCES = [
  'obscénité audible',
  'obscénité visible',
  'abus de balle',
  'abus de raquette ou d\'équipement',
  'abus verbal',
  'abus physique',
  'conseils (coaching)',
  'comportement antisportif',
  'non-respect du code vestimentaire',
];

export const defaultSettings = (): Settings => ({
  id: 'settings',
  offences: [...DEFAULT_OFFENCES],
  durations: { ...DEFAULT_DURATIONS },
  sound: true,
  vibrate: true,
  nameFormat: 'first_last',
  civility: true,
  theme: 'auto',
});

class AppDB extends Dexie {
  matches!: EntityTable<StoredMatch, 'id'>;
  settings!: EntityTable<Settings, 'id'>;

  constructor() {
    super('uspta');
    this.version(1).stores({
      matches: 'id, updatedAt, phase',
      settings: 'id',
    });
  }
}

export const db = new AppDB();

export const configOf = (m: StoredMatch): MatchConfig => ({
  format: FORMATS[m.formatId],
  firstServer: m.firstServer,
  leftAtStart: m.leftAtStart,
  balls: m.balls,
  ...(m.doubles ? { serveOrder: m.serveOrder ?? { A: 0, B: 0 }, receiveOrder: m.receiveOrder ?? { A: 0, B: 0 } } : {}),
});

/** Joueurs d'un côté : un en simple, deux en double. */
export const sidePlayers = (m: StoredMatch, s: Side): Player[] =>
  m.doubles && m.partners ? [m.players[s], m.partners[s]] : [m.players[s]];

/** Copie simple : les objets réactifs de Svelte ne peuvent pas être stockés tels quels. */
export const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export async function loadSettings(): Promise<Settings> {
  const s = await db.settings.get('settings');
  const merged = { ...defaultSettings(), ...s };
  // Anciens réglages : « full » (M. Paul Dupont) ou « short » (M. Dupont).
  const legacy = (s as { nameStyle?: string } | undefined)?.nameStyle;
  if (legacy && !(s as { nameFormat?: string }).nameFormat) merged.nameFormat = legacy === 'short' ? 'last' : 'first_last';
  delete (merged as { nameStyle?: string }).nameStyle;
  if (JSON.stringify(merged.offences) === JSON.stringify(OLD_OFFENCES)) merged.offences = [...DEFAULT_OFFENCES];
  return merged;
}

export async function saveSettings(s: Settings): Promise<void> {
  await db.settings.put(plain(s));
}

export const listMatches = () => db.matches.orderBy('updatedAt').reverse().toArray();

export async function saveMatch(m: StoredMatch): Promise<void> {
  await db.matches.put(plain({ ...m, updatedAt: Date.now() }));
}

export const deleteMatch = (id: string) => db.matches.delete(id);

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
