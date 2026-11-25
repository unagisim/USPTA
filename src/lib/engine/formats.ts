import type { FormatId, MatchFormat } from './types';

const common = { setsToWin: 2, tiebreakPoints: 7, superTiebreakPoints: 10 };

function fmt(
  id: FormatId,
  gamesPerSet: number,
  tiebreakAt: number,
  decidingPoint: boolean,
  finalSetSuperTiebreak: boolean,
  description: string,
): MatchFormat {
  return {
    ...common,
    id,
    label: `Format ${id.slice(1)}`,
    description,
    gamesPerSet,
    tiebreakAt,
    decidingPoint,
    finalSetSuperTiebreak,
  };
}

/** Formats FFT (cahier des charges §3). Figés dans le code. */
export const FORMATS: Record<FormatId, MatchFormat> = {
  F1: fmt('F1', 6, 6, false, false, '3 sets à 6 jeux, jeu décisif à 6-6'),
  F2: fmt('F2', 6, 6, false, true, '2 sets à 6 jeux, jeu décisif à 6-6, super jeu décisif au 3e set'),
  F3: fmt('F3', 4, 4, true, true, '2 sets à 4 jeux, point décisif, jeu décisif à 4-4, super jeu décisif au 3e set'),
  F4: fmt('F4', 6, 6, true, true, '2 sets à 6 jeux, point décisif, jeu décisif à 6-6, super jeu décisif au 3e set'),
  F5: fmt('F5', 3, 2, true, true, '2 sets à 3 jeux, point décisif, jeu décisif à 2-2, super jeu décisif au 3e set'),
  F6: fmt('F6', 4, 3, true, true, '2 sets à 4 jeux, point décisif, jeu décisif à 3-3, super jeu décisif au 3e set'),
  F7: fmt('F7', 5, 4, true, true, '2 sets à 5 jeux, point décisif, jeu décisif à 4-4, super jeu décisif au 3e set'),
};

export const FORMAT_LIST: MatchFormat[] = Object.values(FORMATS);
