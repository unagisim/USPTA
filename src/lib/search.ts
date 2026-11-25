// Recherche d'un match sur l'accueil : joueurs, clubs, compétition, tour, court, date.

import { sidePlayers, type StoredMatch } from './db';

/** Minuscules sans accents, pour comparer « Équipes » et « equipes ». */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

function haystack(m: StoredMatch): string {
  const players = (['A', 'B'] as const).flatMap((s) => sidePlayers(m, s));
  const day = new Date(m.createdAt);
  return fold(
    [
      ...players.flatMap((p) => [p.firstName, p.lastName, p.club ?? '', p.ranking ?? '']),
      m.info.tournament,
      m.info.round,
      m.info.court ? `court ${m.info.court}` : '',
      m.info.umpire,
      m.info.referee,
      m.doubles ? 'double' : 'simple',
      day.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      day.toLocaleDateString('fr-FR'),
    ].join(' '),
  );
}

/** Tous les mots de la recherche doivent être trouvés, dans n'importe quel ordre. */
export function matchesQuery(m: StoredMatch, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const h = haystack(m);
  return words.every((w) => h.includes(w));
}
