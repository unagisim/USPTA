<script lang="ts">
  import { onMount } from 'svelte';
  import { deleteMatch, listMatches, configOf, type StoredMatch } from '../lib/db';
  import { FORMATS, replay, setScoreFor } from '../lib/engine';
  import { pwa, applyUpdate, install } from '../lib/pwa.svelte';

  let { onNew, onOpen, onSettings }: { onNew: () => void; onOpen: (id: string) => void; onSettings: () => void } =
    $props();

  let matches = $state<StoredMatch[]>([]);
  onMount(async () => {
    matches = await listMatches();
  });

  const current = $derived(matches.filter((m) => m.phase !== 'finished'));
  const done = $derived(matches.filter((m) => m.phase === 'finished'));

  const who = (m: StoredMatch) => `${m.players.A.lastName} – ${m.players.B.lastName}`;
  function score(m: StoredMatch): string {
    const s = replay(configOf(m), m.events).state;
    const w = s.winner ?? 'A';
    const sets = s.completedSets.map((set) => setScoreFor(set, w));
    if (!s.winner && s.games.A + s.games.B > 0) sets.push(`${s.games.A}-${s.games.B}`);
    return sets.join(' ');
  }
  const date = (ts: number) => new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  async function remove(m: StoredMatch) {
    if (!confirm(`Supprimer définitivement le match ${who(m)} ? Cette action est irréversible.`)) return;
    await deleteMatch(m.id);
    matches = await listMatches();
  }
</script>

<div class="page">
  <div class="topbar">
    <h1>USPTA</h1>
    <button class="ghost" onclick={onSettings}>Réglages</button>
  </div>

  {#if pwa.needRefresh}
    <div class="notice row">
      <span style="flex:1">Une nouvelle version est prête.</span>
      <button class="primary" onclick={applyUpdate}>Mettre à jour</button>
    </div>
  {/if}

  <button class="primary big" onclick={onNew}>Nouveau match</button>

  {#if current.length}
    <h2>En cours</h2>
    {#each current as m (m.id)}
      <button class="item" onclick={() => onOpen(m.id)}>
        <strong>{who(m)}</strong>
        <span class="muted">
          {m.phase === 'prematch' ? 'Avant le match' : `Reprendre · ${score(m) || 'début'}`} · {FORMATS[m.formatId].label}
        </span>
      </button>
    {/each}
  {/if}

  {#if done.length}
    <h2>Terminés</h2>
    {#each done as m (m.id)}
      <div class="row">
        <button class="item" onclick={() => onOpen(m.id)}>
          <strong>{who(m)}</strong>
          <span class="muted">{date(m.createdAt)} · {score(m)} · {m.info.tournament}</span>
        </button>
        <button class="ghost" aria-label="Supprimer" onclick={() => remove(m)}>✕</button>
      </div>
    {/each}
  {/if}

  {#if pwa.canInstall}
    <button class="install" onclick={install}>Installer l'application sur l'écran d'accueil</button>
  {/if}

  <p class="muted version">Version {__APP_VERSION__} ({__APP_COMMIT__})</p>
</div>

<style>
  .big {
    width: 100%;
    min-height: 64px;
    font-size: 18px;
    margin: 8px 0 20px;
  }
  h2 {
    margin-top: 12px;
  }
  .item {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 10px 14px;
    margin-bottom: 8px;
    text-align: left;
  }
  .row .item {
    flex: 1;
  }
  .install {
    width: 100%;
    margin-top: 16px;
  }
  .version {
    font-size: 13px;
    margin-top: 24px;
  }
</style>
