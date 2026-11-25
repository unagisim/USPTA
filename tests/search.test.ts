import { describe, expect, it } from 'vitest';
import type { StoredMatch } from '../src/lib/db';
import { matchesQuery } from '../src/lib/search';

const m = {
  createdAt: Date.UTC(2026, 10, 25, 10),
  info: { tournament: 'Championnat par équipes National 3', round: '2e journée', court: '3', referee: '', umpire: '' },
  players: { A: { civility: 'M.', firstName: 'Paul', lastName: 'Dupont', club: 'TC Blagnac' }, B: { civility: 'Mme', firstName: 'Julie', lastName: 'Martin' } },
} as unknown as StoredMatch;

describe("recherche d'un match", () => {
  it('par joueur, club, compétition ou date, sans tenir compte des accents', () => {
    expect(matchesQuery(m, 'dupont')).toBe(true);
    expect(matchesQuery(m, 'blagnac martin')).toBe(true);
    expect(matchesQuery(m, 'equipes national')).toBe(true);
    expect(matchesQuery(m, 'novembre')).toBe(true);
    expect(matchesQuery(m, 'simple')).toBe(true);
    expect(matchesQuery(m, 'nadal')).toBe(false);
    expect(matchesQuery(m, '')).toBe(true);
  });
});
