<script lang="ts">
  import { app, updateSettings } from '../lib/state.svelte';
  import { playerName } from '../lib/annonces';
  import { DEFAULT_OFFENCES, type NameFormat, type Theme } from '../lib/db';
  import { DEFAULT_DURATIONS, type Durations } from '../lib/engine';

  let { onBack }: { onBack: () => void } = $props();

  let newOffence = $state('');

  const durationLabels: Record<keyof Durations, string> = {
    warmup: 'Échauffement',
    changeover: 'Changement de côté',
    setBreak: 'Fin de manche',
    medical: 'Temps mort médical',
    toilet: 'Pause toilettes ou tenue',
  };
  const keys = Object.keys(durationLabels) as (keyof Durations)[];

  function setDuration(k: keyof Durations, value: string) {
    const s = Math.max(0, Math.round(Number(value)));
    if (Number.isFinite(s)) void updateSettings({ durations: { ...app.settings.durations, [k]: s } });
  }
  function addOffence() {
    const o = newOffence.trim();
    if (!o) return;
    void updateSettings({ offences: [...app.settings.offences, o] });
    newOffence = '';
  }
  function removeOffence(i: number) {
    void updateSettings({ offences: app.settings.offences.filter((_, j) => j !== i) });
  }
  function renameOffence(i: number, value: string) {
    const v = value.trim();
    if (v) void updateSettings({ offences: app.settings.offences.map((o, j) => (j === i ? v : o)) });
  }

  const themes: [Theme, string][] = [
    ['auto', 'Automatique'],
    ['light', 'Clair'],
    ['dark', 'Sombre'],
    ['sun', 'Plein soleil'],
  ];
  const FORMATS: [NameFormat, string][] = [
    ['first_last', 'Prénom Nom'],
    ['initial_last', 'P. Nom'],
    ['last', 'Nom'],
    ['first', 'Prénom'],
  ];
  const example = { civility: 'M.' as const, firstName: 'Paul', lastName: 'Dupont' };
</script>

<div class="page">
  <div class="topbar">
    <button class="ghost" onclick={onBack}>← Retour</button>
    <h1>Réglages</h1>
  </div>

  <div class="card stack">
    <h2>Affichage</h2>
    <div class="seg">
      {#each themes as [t, label] (t)}
        <button aria-pressed={app.settings.theme === t} onclick={() => updateSettings({ theme: t })}>{label}</button>
      {/each}
    </div>
    <label for="ns">Noms à l'écran et dans la présentation du match</label>
    <div class="seg" id="ns">
      {#each FORMATS as [f, label] (f)}
        <button aria-pressed={app.settings.nameFormat === f} onclick={() => updateSettings({ nameFormat: f })}>{label}</button>
      {/each}
    </div>
    <label class="check">
      <input type="checkbox" checked={app.settings.civility} onchange={(e) => updateSettings({ civility: e.currentTarget.checked })} />
      Civilité devant le nom (M., Mme, Mlle)
    </label>
    <p class="muted">Exemple : {playerName(example, { format: app.settings.nameFormat, civility: app.settings.civility })}</p>
    <p class="muted">Les annonces du score suivent l'usage FFT : « Mme Kerber », « Tsonga », ou le nom du club en match par équipes.</p>
  </div>

  <div class="card stack">
    <h2>Alertes des chronomètres</h2>
    <label class="check"><input type="checkbox" checked={app.settings.sound} onchange={(e) => updateSettings({ sound: e.currentTarget.checked })} /> Bip</label>
    <label class="check"><input type="checkbox" checked={app.settings.vibrate} onchange={(e) => updateSettings({ vibrate: e.currentTarget.checked })} /> Vibration</label>
  </div>

  <div class="card stack">
    <h2>Durées (secondes)</h2>
    {#each keys as k (k)}
      <div class="row">
        <label for="d{k}" class="grow">{durationLabels[k]}</label>
        <input id="d{k}" class="num" type="number" min="0" value={app.settings.durations[k]} onchange={(e) => setDuration(k, e.currentTarget.value)} />
      </div>
    {/each}
    <button onclick={() => updateSettings({ durations: { ...DEFAULT_DURATIONS } })}>Revenir aux durées par défaut</button>
  </div>

  <div class="card stack">
    <h2>Infractions au code de conduite</h2>
    {#each app.settings.offences as o, i (o + i)}
      <div class="row">
        <input value={o} onchange={(e) => renameOffence(i, e.currentTarget.value)} aria-label="Infraction" />
        <button class="ghost" aria-label="Retirer" onclick={() => removeOffence(i)}>✕</button>
      </div>
    {/each}
    <div class="row">
      <input bind:value={newOffence} placeholder="Nouvelle infraction" />
      <button onclick={addOffence}>Ajouter</button>
    </div>
    <button onclick={() => updateSettings({ offences: [...DEFAULT_OFFENCES] })}>Revenir à la liste de départ</button>
  </div>
</div>

<style>
  .grow {
    flex: 1;
    margin: 0;
    color: var(--text);
    font-size: 16px;
  }
  .num {
    width: 100px;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--text);
    font-size: 16px;
  }
  .check input {
    width: 24px;
    min-height: 24px;
  }
</style>
