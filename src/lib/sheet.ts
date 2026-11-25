// Contenu de la feuille de match, commun à l'écran et à l'export PDF.

import type { StoredMatch, TossChoice } from './db';
import { describeEntry, describeRaw, describeTimer, scoreBefore } from './describe';
import { setScoreFor, type LogEntry, type MatchEvent, type ReplayResult, type Side } from './engine';

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
      default: {
        const text = entry ? describeEntry(entry, names) : describeRaw(e, names);
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
