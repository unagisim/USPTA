import { describe, expect, it } from 'vitest';
import type { StoredMatch } from '../src/lib/db';
import { buildSheetPdf } from '../src/lib/export/pdf';
import { Rec } from './helpers';

describe('export PDF de la feuille', () => {
  it('produit un PDF A4 avec un nom de fichier lisible', async () => {
    const r = new Rec('F2');
    r.add({ kind: 'start' });
    r.alternate(8).games('A', 2);
    r.add({ kind: 'conduct', player: 'B', offence: 'Jet de balle' });
    r.alternate(4, 'B').point('A');
    r.add({ kind: 'undo', target: r.events[r.events.length - 1].id, reason: 'erreur de saisie' });
    r.add({ kind: 'timer', timer: 'toilet', action: 'start', player: 'A' });
    r.add({ kind: 'timer', timer: 'toilet', action: 'stop', player: 'A' });
    r.games('B', 4);
    const m: StoredMatch = {
      id: 'x',
      createdAt: Date.UTC(2026, 10, 25, 9),
      updatedAt: 0,
      info: { tournament: 'Championnat par équipes National 3', round: '2e journée', court: '3', referee: 'Mme Juge', umpire: 'J. Arbitre', umpireLicence: '123', team: false },
      players: {
        A: { civility: 'M.', firstName: 'Paul', lastName: 'Dupont', club: 'TC Blagnac', ranking: '15/1' },
        B: { civility: 'Mme', firstName: 'Julie', lastName: 'Martin', club: 'ASPTT', ranking: '15' },
      },
      formatId: 'F2',
      balls: { mode: 'none' },
      firstServer: 'A',
      leftAtStart: 'B',
      toss: { winner: 'A', choice: 'serve' },
      checklist: {},
      events: r.events,
      phase: 'live',
      winner: null,
    };
    const { blob, fileName } = buildSheetPdf(m, r.r, { A: 'M. Paul Dupont', B: 'Mme Julie Martin' });
    expect(fileName).toMatch(/^feuille-\d{4}-\d{2}-\d{2}-dupont-martin\.pdf$/);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  });
});
