// Alertes (bip, vibration) et écran toujours allumé pendant le match.

let audio: AudioContext | null = null;

/** Bip court ; `long` pour la fin d'un chronomètre. */
export function beep(long = false): void {
  try {
    audio ??= new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = long ? 660 : 880;
    gain.gain.value = 0.2;
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + (long ? 0.6 : 0.15));
  } catch {
    // Son indisponible : la vibration et l'affichage suffisent.
  }
}

export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration indisponible (iOS, ordinateur).
  }
}

export function alert(opts: { sound: boolean; vibrate: boolean }, final: boolean): void {
  if (opts.sound) beep(final);
  if (opts.vibrate) vibrate(final ? [300, 150, 300] : 150);
}

/** Garde l'écran allumé tant que la fonction renvoyée n'a pas été appelée. */
export function keepAwake(): () => void {
  let lock: WakeLockSentinel | null = null;
  let active = true;
  const request = async () => {
    try {
      if (active && document.visibilityState === 'visible' && 'wakeLock' in navigator) {
        lock = await navigator.wakeLock.request('screen');
      }
    } catch {
      lock = null;
    }
  };
  const onVisible = () => void request();
  void request();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    active = false;
    document.removeEventListener('visibilitychange', onVisible);
    lock?.release().catch(() => {});
  };
}

/** Durée en mm:ss (ou h:mm:ss). */
export function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

/** Heure locale hh:mm. */
export const hour = (ts: number) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
