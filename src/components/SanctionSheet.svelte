<script lang="ts">
  import Sheet from './Sheet.svelte';
  import { announce } from '../lib/annonces';
  import { conductLevel, other, timeLevel, type ConductLevel, type Side, type TimeLevel } from '../lib/engine';
  import { app, type LiveMatch } from '../lib/state.svelte';

  let { live, left, onClose, onDone }: { live: LiveMatch; left: Side; onClose: () => void; onDone: () => void } = $props();

  const LEVELS: Record<ConductLevel | TimeLevel, string> = {
    warning: 'avertissement',
    point: '1 point de pénalité',
    three_points: '3 points de pénalité',
    disqualification: 'appel du juge-arbitre',
  };

  let player = $state<Side | null>(null);
  let kind = $state<'conduct' | 'time' | null>(null);
  let other_ = $state('');
  let note = $state('');
  /** Joueur concerné par une 4e infraction : décision du juge-arbitre attendue. */
  let dq = $state<Side | null>(null);
  let lines = $state<string[]>([]);

  const nextConduct = (p: Side) => conductLevel(live.result.conductCount[p] + 1);
  const nextTime = (p: Side) => timeLevel(live.result.timeViolationCount[p] + 1);

  async function conduct(offence: string) {
    if (!player || !offence.trim()) return;
    const level = nextConduct(player);
    await live.add({ kind: 'conduct', player, offence: offence.trim(), ...(note.trim() ? { note: note.trim() } : {}) });
    if (level === 'disqualification') {
      lines = announce(live.result.log[live.result.log.length - 1], live.ctx);
      dq = player;
    } else onDone();
  }
  async function timeViolation() {
    if (!player) return;
    await live.add({ kind: 'time_violation', player, ...(note.trim() ? { note: note.trim() } : {}) });
    onDone();
  }
  async function disqualify() {
    if (!dq) return;
    await live.add({ kind: 'end', type: 'disqualification', loser: dq, note: 'Décision du juge-arbitre' });
    onDone();
  }
</script>

<Sheet title="Sanction" {onClose}>
  {#if dq}
    <div class="notice">
      {#each lines as l (l)}<p>{l}</p>{/each}
    </div>
    <p>Décision du juge-arbitre :</p>
    <button class="danger" onclick={disqualify}>Disqualification de {live.name(dq)}</button>
    <button onclick={onDone}>Pas de disqualification, on continue</button>
  {:else if !player}
    <p class="muted">Joueur concerné :</p>
    <div class="players">
      <button class="pl" onclick={() => (player = left)}>{live.name(left)}</button>
      <button class="pr" onclick={() => (player = other(left))}>{live.name(other(left))}</button>
    </div>
  {:else if !kind}
    {@const p = player}
    <p><strong>{live.name(p)}</strong></p>
    <button onclick={() => (kind = 'conduct')}>
      Code de conduite <small>· {live.result.conductCount[p]} déjà · prochaine sanction : {LEVELS[nextConduct(p)]}</small>
    </button>
    <button onclick={() => (kind = 'time')}>
      Dépassement de temps <small>· {live.result.timeViolationCount[p]} déjà · prochaine sanction : {LEVELS[nextTime(p)]}</small>
    </button>
    <button class="ghost" onclick={() => (player = null)}>← Changer de joueur</button>
  {:else if kind === 'conduct'}
    {@const p = player}
    <p><strong>{live.name(p)}</strong> · sanction : <strong>{LEVELS[nextConduct(p)]}</strong></p>
    <label for="note">Note (facultative)</label>
    <input id="note" bind:value={note} />
    <p class="muted">Infraction :</p>
    {#each app.settings.offences as o (o)}
      <button onclick={() => conduct(o)}>{o}</button>
    {/each}
    <div class="row">
      <input bind:value={other_} placeholder="Autre infraction" />
      <button onclick={() => conduct(other_)} disabled={!other_.trim()}>Valider</button>
    </div>
    <button class="ghost" onclick={() => (kind = null)}>← Retour</button>
  {:else}
    {@const p = player}
    <p>
      <strong>{live.name(p)}</strong> · sanction : <strong>{LEVELS[nextTime(p)]}</strong>
    </p>
    <p class="muted">
      Après l'avertissement, chaque nouvelle validation donne 1 point à l'adversaire. À vous de juger chaque tranche de 30 secondes.
    </p>
    <label for="tnote">Note (facultative)</label>
    <input id="tnote" bind:value={note} />
    <button class="primary" onclick={timeViolation}>Valider le dépassement de temps</button>
    <button class="ghost" onclick={() => (kind = null)}>← Retour</button>
  {/if}
</Sheet>

<style>
  .players {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .players button {
    min-height: 80px;
    font-weight: 700;
    width: 100%;
  }
  .pl {
    background: var(--l-bg);
    color: var(--l);
    border-color: var(--l-strong);
  }
  .pr {
    background: var(--r-bg);
    color: var(--r);
    border-color: var(--r-strong);
  }
  small {
    color: var(--muted);
  }
  .notice p {
    margin: 4px 0;
  }
</style>
