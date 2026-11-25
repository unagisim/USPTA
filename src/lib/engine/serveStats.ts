// Statistiques au service, tirées du journal du match (saisies annulées exclues, corrections appliquées).
// Un point saisi sans faute préalable est compté comme joué sur première balle.

import type { LogEntry } from './match';
import { other, type Side } from './types';

export interface ServeStats {
  /** Points joués au service (points, aces, doubles fautes ; hors pénalités). */
  points: number;
  /** Premières balles dans le court. */
  firstIn: number;
  /** Points gagnés sur première balle. */
  firstWon: number;
  /** Points joués sur deuxième balle, doubles fautes comprises. */
  second: number;
  /** Points gagnés sur deuxième balle. */
  secondWon: number;
  aces: number;
  doubleFaults: number;
  /** Filets au service (balle à rejouer). */
  nets: number;
}

const empty = (): ServeStats => ({ points: 0, firstIn: 0, firstWon: 0, second: 0, secondWon: 0, aces: 0, doubleFaults: 0, nets: 0 });

/** Point joué au service : vainqueur et balle de service, ou null pour les autres saisies. */
export function servedPoint(entry: LogEntry): { server: Side; winner: Side; ball: 1 | 2; ace: boolean; doubleFault: boolean } | null {
  const { event: e, before, outcome: o } = entry;
  const server = before.server;
  const ball = before.serveNumber;
  if (e.kind === 'point') return { server, winner: e.winner, ball, ace: false, doubleFault: false };
  if (e.kind === 'serve' && o.serveCall === 'ace') return { server, winner: server, ball, ace: true, doubleFault: false };
  if (e.kind === 'serve' && o.serveCall === 'double_fault') return { server, winner: other(server), ball: 2, ace: false, doubleFault: true };
  return null;
}

/** Clé d'un joueur : côté et rang dans l'équipe (« A0 », « B1 »). En simple, toujours 0. */
export type PlayerKey = `${Side}${0 | 1}`;

export function serveStats(log: readonly LogEntry[], set?: number): Record<Side, ServeStats> {
  return tally(log, set, (e) => e.before.server) as Record<Side, ServeStats>;
}

/** Double : statistiques de chaque joueur au service. */
export function serveStatsByPlayer(log: readonly LogEntry[], set?: number): Record<PlayerKey, ServeStats> {
  return tally(log, set, (e) => `${e.before.server}${e.serverIndex}` as PlayerKey) as Record<PlayerKey, ServeStats>;
}

function tally(log: readonly LogEntry[], set: number | undefined, key: (e: LogEntry) => string): Record<string, ServeStats> {
  const st: Record<string, ServeStats> = { A: empty(), B: empty(), A0: empty(), A1: empty(), B0: empty(), B1: empty() };
  for (const entry of log) {
    if (set !== undefined && entry.before.completedSets.length + 1 !== set) continue;
    if (entry.event.kind === 'serve' && entry.event.call === 'net') st[key(entry)].nets++;
    const p = servedPoint(entry);
    if (!p) continue;
    const s = st[key(entry)];
    const won = p.winner === p.server;
    s.points++;
    if (p.ace) s.aces++;
    if (p.doubleFault) s.doubleFaults++;
    if (p.ball === 1) {
      s.firstIn++;
      if (won) s.firstWon++;
    } else {
      s.second++;
      if (won) s.secondWon++;
    }
  }
  return st;
}

/** « 12/20 (60 %) », ou « – » sans donnée. */
export function ratio(n: number, total: number): string {
  return total ? `${n}/${total} (${Math.round((100 * n) / total)} %)` : '–';
}

/** Lignes d'affichage, communes à l'écran et au PDF : un libellé puis une valeur par colonne. */
export function serveStatRows(st: Record<Side, ServeStats> | ServeStats[]): string[][] {
  const cols = Array.isArray(st) ? st : [st.A, st.B];
  const row = (label: string, f: (s: ServeStats) => string): string[] => [label, ...cols.map(f)];
  return [
    row('Points au service', (s) => String(s.points)),
    row('1res balles dans le court', (s) => ratio(s.firstIn, s.points)),
    row('Points gagnés sur 1re balle', (s) => ratio(s.firstWon, s.firstIn)),
    row('Points gagnés sur 2e balle', (s) => ratio(s.secondWon, s.second)),
    row('Aces', (s) => String(s.aces)),
    row('Doubles fautes', (s) => String(s.doubleFaults)),
    row('Filets au service', (s) => String(s.nets)),
  ];
}
