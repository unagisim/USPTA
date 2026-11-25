// Contenu de la feuille de match, commun à l'écran et à l'export PDF.

import { sidePlayers, type StoredMatch, type TossChoice } from './db';
import { describeEntry, describeRaw, describeTimer, scoreBefore } from './describe';
import { serveStatRows, serveStats, serveStatsByPlayer, setScoreFor, type LogEntry, type MatchEvent, type ReplayResult, type Side } from './engine';

export interface SheetRow {
  id: number;
  ts: number;
  score: string;
  text: string;
  kind: 'play' | 'sanction' | 'time' | 'correction' | 'other';
  /** Saisie annulée par une correction. */
  struck: boolean;
}

const REASONS = { retirement: 'abandon', disqualification: 'disqualification', walkover: 'forfait', completed: '' };

export function sanctionText(level: string): string {
  return (
    { warning: 'avertissement', point: '1 point de pénalité', three_points: '3 points de pénalité', disqualification: 'appel du juge-arbitre' }[
      level
    ] ?? level
  );
}

export const TOSS_CHOICES: Record<TossChoice, string> = {
  serve: 'servir',
  receive: 'recevoir',
  side: 'choix du côté',
  defer: "choix laissé à l'adversaire",
};

/** « M. Paul Dupont gagne 6-4 3-6 10-7 (abandon) », ou null si le match n'est pas fini. */
export function resultText(r: ReplayResult, names: Record<Side, string>): string | null {
  const s = r.state;
  if (!s.winner) return null;
  const sets = s.completedSets.map((set) => setScoreFor(set, s.winner!)).join(' ');
  const how = s.endReason && s.endReason !== 'completed' ? ` (${REASONS[s.endReason]})` : '';
  return `${names[s.winner]} gagne ${sets}${how}`.replace(/ +/g, ' ');
}

export function sheetRows(m: StoredMatch, r: ReplayResult, names: Record<Side, string>): SheetRow[] {
  const byId = new Map<number, LogEntry>(r.log.map((e) => [e.event.id, e]));
  const servers = m.doubles
    ? { A: sidePlayers(m, 'A').map((p) => `${p.civility} ${p.lastName}`), B: sidePlayers(m, 'B').map((p) => `${p.civility} ${p.lastName}`) }
    : undefined;
  const voided = new Set(m.events.filter((e) => e.kind === 'undo').map((e) => (e as Extract<MatchEvent, { kind: 'undo' }>).target));

  return m.events.map((e): SheetRow => {
    const entry = byId.get(e.id);
    const base = { id: e.id, ts: e.ts, score: entry ? scoreBefore(entry) : '', struck: voided.has(e.id) };
    switch (e.kind) {
      case 'undo':
        return { ...base, kind: 'correction', text: `Correction : saisie n° ${e.target} annulée${e.reason ? ` (${e.reason})` : ''}` };
      case 'replace': {
        const w = e.with;
        const what = w.kind === 'point' ? `point à ${names[w.winner]}` : w.kind === 'let' ? 'point à rejouer' : w.call;
        return { ...base, kind: 'correction', text: `Correction : saisie n° ${e.target} remplacée par ${what}${e.reason ? ` (${e.reason})` : ''}` };
      }
      case 'timer':
        return { ...base, kind: 'time', text: describeTimer(e, names) };
      case 'start':
        return { ...base, kind: 'other', text: 'Début du match' };
      case 'note':
        return { ...base, kind: 'other', text: `Note : ${e.text}` };
      case 'serve_order': {
        const first = (['A', 'B'] as const).map((s) => servers?.[s][e.first[s]] ?? names[s]).join(' et ');
        const rcv = e.receive ? (['A', 'B'] as const).map((s) => servers?.[s][e.receive![s]] ?? names[s]).join(' et ') : '';
        return {
          ...base,
          kind: 'other',
          text: e.reason
            ? `Correction des positions (${e.reason})${rcv ? ` : ${rcv} relancent côté droit` : ''}`
            : `Positions de la manche : ${first} servent en premier${rcv ? ` ; ${rcv} relancent côté droit` : ''}`,
        };
      }
      default: {
        const text = entry ? describeEntry(entry, names, servers) : describeRaw(e, names);
        const sanction = entry?.outcome.sanction;
        const extra = sanction ? ` : ${sanctionText(sanction.level)}` : '';
        const note = 'note' in e && e.note ? ` (${e.note})` : '';
        const reason = 'reason' in e && e.reason ? ` (${e.reason})` : '';
        const kind =
          e.kind === 'conduct' || e.kind === 'time_violation'
            ? 'sanction'
            : e.kind === 'set_server' || e.kind === 'adjust'
              ? 'correction'
              : e.kind === 'end'
                ? 'other'
                : 'play';
        return { ...base, kind, text: `${text}${extra}${note}${reason}${entry?.replaced ? ' (corrigé)' : ''}` };
      }
    }
  });
}

/** Tableau de statistiques au service : une colonne par joueur (ou par équipe). */
export interface StatTable {
  cols: { label: string; side: Side }[];
  rows: string[][];
}

/**
 * Statistiques au service, pour l'écran et le PDF. En double, `byPlayer` donne un tableau
 * par équipe avec ses deux joueurs ; sinon un seul tableau, une colonne par côté.
 */
export function statTables(m: StoredMatch, log: readonly LogEntry[], set: number | undefined, byPlayer: boolean): StatTable[] {
  const sides = ['A', 'B'] as const;
  if (byPlayer && m.doubles) {
    const st = serveStatsByPlayer(log, set);
    return sides.map((s) => ({
      cols: sidePlayers(m, s).map((p) => ({ label: p.lastName, side: s })),
      rows: serveStatRows([st[`${s}0`], st[`${s}1`]]),
    }));
  }
  const label = (s: Side) => sidePlayers(m, s).map((p) => p.lastName).join(' / ');
  return [{ cols: sides.map((s) => ({ label: label(s), side: s })), rows: serveStatRows(serveStats(log, set)) }];
}

export interface SetTime {
  set: number;
  start: number | null;
  end: number | null;
}

/**
 * Heures de chaque manche. Début : le lancement du match pour la 1re manche, sinon la première
 * saisie de jeu de la manche (fin du premier échange, à quelques secondes près). Fin : le point
 * qui termine la manche, ou la fin anticipée du match.
 */
export function setTimes(r: ReplayResult): SetTime[] {
  const out: SetTime[] = [];
  for (const e of r.log) {
    const n = e.before.completedSets.length + 1;
    const played = e.outcome.pointWinner !== undefined || e.outcome.serveCall !== undefined || e.outcome.gameWinner !== undefined;
    if (!out[n - 1] && (played || e.after.winner)) out[n - 1] = { set: n, start: n === 1 ? (r.start ?? e.event.ts) : e.event.ts, end: null };
    const cur = out[n - 1];
    if (cur && (e.outcome.setWinner || (e.after.winner && !e.before.winner))) cur.end = e.event.ts;
  }
  return out.filter(Boolean);
}
