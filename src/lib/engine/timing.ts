// Durées des chronomètres (cahier des charges §5.1), en secondes. Modifiables dans les réglages.

export interface Durations {
  warmup: number;
  changeover: number;
  setBreak: number;
  medical: number;
  toilet: number;
}

export const DEFAULT_DURATIONS: Durations = {
  warmup: 5 * 60,
  changeover: 90,
  setBreak: 120,
  medical: 3 * 60,
  toilet: 3 * 60,
};

/** Pauses toilettes ou tenue autorisées par joueur et par match, échauffement compris. */
export const MAX_TOILET_BREAKS = 2;

/** Annonce « 2 minutes » pendant l'échauffement, en secondes restantes. */
export const WARMUP_TWO_MINUTES = 2 * 60;
/** Présentation du match, en secondes avant la fin de l'échauffement (50 s en double, V2). */
export const PRESENTATION_AT = 40;
export const PRESENTATION_AT_DOUBLES = 50;
/** Alertes (vibration, bip) de l'échauffement, en secondes restantes. */
export const WARMUP_CALLS = [WARMUP_TWO_MINUTES, PRESENTATION_AT, 0];

/** Annonce « Reprise », en secondes avant la fin d'une pause. */
export const RESUME_CALL_AT = 30;
/** Alertes (vibration, bip) des chronomètres de pause, en secondes restantes. */
export const REST_ALERTS = [RESUME_CALL_AT, 0];
