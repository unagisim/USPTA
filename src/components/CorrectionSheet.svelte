<script lang="ts">
  import { untrack } from 'svelte';
  import Sheet from './Sheet.svelte';
  import { describeEntry, scoreBefore } from '../lib/describe';
  import { other, type LogEntry, type Pair, type Side } from '../lib/engine';
  import type { LiveMatch } from '../lib/state.svelte';

  let {
    live,
    left,
    onClose,
    onDone,
  }: { live: LiveMatch; left: Side; onClose: () => void; onDone: (message: string) => void } = $props();

  const REASONS = ['Erreur de saisie', 'Overrule', 'Réclamation acceptée', 'Autre'];
  let reason = $state(REASONS[0]);
  let selected = $state<number | null>(null);
  let view = $state<'list' | 'adjust'>('list');

  const names = $derived({ A: live.name('A'), B: live.name('B') });
  const recent = $derived(
    live.result.log
      .filter((e) => e.event.kind === 'serve' || e.event.kind === 'point' || e.event.kind === 'let')
      .slice(-15)
      .reverse(),
  );

  async function replacePoint(entry: LogEntry, winner: Side) {
    await live.add({ kind: 'replace', target: entry.event.id, with: { kind: 'point', winner }, reason });
    onDone(`Correction : point à ${names[winner]}`);
  }
  async function replaceLet(entry: LogEntry) {
    await live.add({ kind: 'replace', target: entry.event.id, with: { kind: 'let' }, reason });
    onDone('Correction : point à rejouer');
  }
  async function remove(entry: LogEntry) {
    await live.add({ kind: 'undo', target: entry.event.id, reason });
    onDone('Saisie supprimée');
  }
  async function wrongServer() {
    const server = other(live.state.server);
    await live.add({ kind: 'set_server', server, reason: 'Erreur de serveur' });
    onDone(`${names[server]} au service, les points joués restent acquis`);
  }

  // ---- Score fixé à la main ----
  // Valeurs de départ du formulaire : le score au moment d'ouvrir le panneau.
  const s = untrack(() => live.state);
  let setsText = $state(s.completedSets.map((x) => `${x.games.A}-${x.games.B}`).join(' '));
  let games = $state<Pair>({ ...s.games });
  let points = $state<Pair>({ ...s.points });
  let server = $state<Side>(s.server);
  let adjustError = $state('');
  const POINT_LABELS = ['0', '15', '30', '40', 'AV'];

  async function adjust() {
    const sets: Pair[] = [];
    for (const part of setsText.trim().split(/\s+/).filter(Boolean)) {
      const m = /^(\d+)-(\d+)$/.exec(part);
      if (!m) {
        adjustError = `Set illisible : « ${part} ». Écrivez par exemple 6-4 3-6.`;
        return;
      }
      sets.push({ A: Number(m[1]), B: Number(m[2]) });
    }
    await live.add({ kind: 'adjust', sets, games: { ...games }, points: { ...points }, server, reason });
    onDone('Score corrigé à la main');
  }
</script>

<Sheet title="Corrections" {onClose}>
  <label for="reason">Motif</label>
  <select id="reason" bind:value={reason}>
    {#each REASONS as r (r)}<option>{r}</option>{/each}
  </select>

  {#if view === 'list'}
    <h3>Saisies récentes</h3>
    {#each recent as entry (entry.event.id)}
      <button class="entry" class:open={selected === entry.event.id} onclick={() => (selected = selected === entry.event.id ? null : entry.event.id)}>
        <span>{describeEntry(entry, names)}{entry.replaced ? ' (corrigé)' : ''}</span>
        <small>{scoreBefore(entry)}</small>
      </button>
      {#if selected === entry.event.id}
        <div class="actions">
          <button onclick={() => replacePoint(entry, left)}>Point à {names[left]}</button>
          <button onclick={() => replacePoint(entry, other(left))}>Point à {names[other(left)]}</button>
          <button onclick={() => replaceLet(entry)}>Point à rejouer</button>
          <button class="danger" onclick={() => remove(entry)}>Supprimer cette saisie</button>
        </div>
      {/if}
    {:else}
      <p class="muted">Aucune saisie pour l'instant.</p>
    {/each}

    <h3>Erreur de service</h3>
    <button onclick={wrongServer} disabled={!!live.state.winner}>
      Mauvais serveur : {names[other(live.state.server)]} doit servir
    </button>
    <p class="muted">Les points déjà joués restent acquis. Un mauvais côté de service se corrige simplement au point suivant.</p>

    <h3>Dernier recours</h3>
    <button onclick={() => (view = 'adjust')}>Fixer le score à la main</button>
  {:else}
    <h3>Fixer le score</h3>
    <p class="muted">Ordre : {names.A}, puis {names.B}.</p>
    <label for="sets">Sets terminés</label>
    <input id="sets" bind:value={setsText} placeholder="6-4 3-6" />
    <div class="grid2">
      <div><label for="ga">Jeux {names.A}</label><input id="ga" type="number" min="0" bind:value={games.A} /></div>
      <div><label for="gb">Jeux {names.B}</label><input id="gb" type="number" min="0" bind:value={games.B} /></div>
      <div>
        <label for="pa">Points {names.A}</label>
        <select id="pa" bind:value={points.A}>{#each POINT_LABELS as l, i (l)}<option value={i}>{l}</option>{/each}</select>
      </div>
      <div>
        <label for="pb">Points {names.B}</label>
        <select id="pb" bind:value={points.B}>{#each POINT_LABELS as l, i (l)}<option value={i}>{l}</option>{/each}</select>
      </div>
    </div>
    <label for="srv">Au service</label>
    <div class="seg" id="srv">
      {#each ['A', 'B'] as const as x (x)}
        <button aria-pressed={server === x} onclick={() => (server = x)}>{names[x]}</button>
      {/each}
    </div>
    {#if adjustError}<p class="notice">{adjustError}</p>{/if}
    <button class="primary" onclick={adjust}>Enregistrer ce score</button>
    <button class="ghost" onclick={() => (view = 'list')}>← Retour</button>
  {/if}
</Sheet>

<style>
  h3 {
    font-size: 16px;
    margin: 16px 0 8px;
  }
  .entry {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    padding: 8px 12px;
  }
  .entry.open {
    border-color: var(--accent);
  }
  .actions {
    padding-left: 16px;
  }
  .grid2 {
    margin: 8px 0;
  }
</style>
