<script lang="ts">
  import { onMount } from 'svelte';
  import { deleteMatch, listMatches, configOf, sidePlayers, type StoredMatch } from '../lib/db';
  import { matchesQuery } from '../lib/search';
  import { FORMATS, replay, setScoreFor } from '../lib/engine';
  import { pwa, applyUpdate, install } from '../lib/pwa.svelte';

  let { onNew, onOpen, onSettings }: { onNew: () => void; onOpen: (id: string) => void; onSettings: () => void } =
    $props();

  let matches = $state<StoredMatch[]>([]);
  onMount(async () => {
    matches = await listMatches();
  });

  let query = $state('');
  const found = $derived(matches.filter((m) => matchesQuery(m, query)));
  const current = $derived(found.filter((m) => m.phase !== 'finished'));
  const done = $derived(found.filter((m) => m.phase === 'finished'));

  const side = (m: StoredMatch, s: 'A' | 'B') => sidePlayers(m, s).map((p) => p.lastName).join(' / ');
  const who = (m: StoredMatch) => `${side(m, 'A')} – ${side(m, 'B')}`;
  function score(m: StoredMatch): string {
    const s = replay(configOf(m), m.events).state;
    const w = s.winner ?? 'A';
    const sets = s.completedSets.map((set) => setScoreFor(set, w));
    if (!s.winner && s.games.A + s.games.B > 0) sets.push(`${s.games.A}-${s.games.B}`);
    return sets.join(' ');
  }
  const date = (ts: number) => new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  /** Match dont la suppression attend une confirmation. */
  let confirmId = $state<string | null>(null);
  let deleteError = $state('');
  async function remove(id: string) {
    deleteError = '';
    try {
      await deleteMatch(id);
      matches = matches.filter((m) => m.id !== id);
      confirmId = null;
    } catch {
      deleteError = 'La suppression a échoué. Réessayez.';
    }
  }
</script>

<div class="page">
  <div class="topbar brand">
    <img src="{import.meta.env.BASE_URL}logo.png" alt="US Pontet Tennis" width="56" height="55" />
    <h1>USPTA<small>Assistant de l'arbitre de chaise</small></h1>
    <button class="ghost" onclick={onSettings}>Réglages</button>
  </div>

  {#if pwa.needRefresh}
    <div class="notice row">
      <span style="flex:1">Une nouvelle version est prête.</span>
      <button class="primary" onclick={applyUpdate}>Mettre à jour</button>
    </div>
  {/if}

  <button class="primary big" onclick={onNew}>Nouveau match</button>

  {#if matches.length > 1}
    <div class="search">
      <input
        type="search"
        bind:value={query}
        placeholder="Rechercher : joueur, club, compétition, date…"
        aria-label="Rechercher un match"
        autocomplete="off"
      />
    </div>
    {#if query && !found.length}<p class="muted">Aucun match ne correspond à « {query} ».</p>{/if}
  {/if}

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
    {#if deleteError}<p class="error" role="alert">{deleteError}</p>{/if}
    {#each done as m (m.id)}
      <div class="line" class:confirming={confirmId === m.id}>
        <button class="item" onclick={() => onOpen(m.id)}>
          <strong>{who(m)}</strong>
          <span class="muted">{date(m.createdAt)} · {score(m)}{m.info.tournament ? ` · ${m.info.tournament}` : ''}</span>
        </button>
        {#if confirmId === m.id}
          <div class="confirm" role="alertdialog" aria-label="Confirmer la suppression">
            <span>Supprimer définitivement ce match et sa feuille ? Cette action est irréversible.</span>
            <div>
              <button onclick={() => (confirmId = null)}>Annuler</button>
              <button class="danger" onclick={() => remove(m.id)}>Supprimer</button>
            </div>
          </div>
        {:else}
          <button class="trash" aria-label="Supprimer ce match" title="Supprimer" onclick={() => (confirmId = m.id)}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"
              ><path
                d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              /></svg
            >
          </button>
        {/if}
      </div>
    {/each}
  {/if}

  {#if pwa.canInstall}
    <button class="install" onclick={install}>Installer l'application sur l'écran d'accueil</button>
  {/if}

  <p class="muted version">Version {__APP_VERSION__} ({__APP_COMMIT__})</p>
</div>

<style>
  .brand {
    gap: 10px;
  }
  .brand img {
    flex: none;
    border-radius: 10px;
    background: #fff;
  }
  .brand h1 {
    flex: 1;
    display: flex;
    flex-direction: column;
    line-height: 1.1;
  }
  .brand small {
    font-size: 13px;
    font-weight: 500;
    color: var(--muted);
  }
  .search {
    margin: -8px 0 12px;
  }
  .search input {
    width: 100%;
  }
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
  .line {
    display: flex;
    gap: 6px;
    align-items: stretch;
    margin-bottom: 8px;
  }
  .line .item {
    flex: 1;
    min-width: 0;
    margin-bottom: 0;
  }
  .line.confirming {
    flex-direction: column;
  }
  .trash {
    flex: none;
    width: 48px;
    padding: 0;
    color: var(--muted);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .confirm {
    background: var(--danger-bg);
    color: var(--danger);
    border-radius: var(--radius);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 14px;
  }
  .confirm div {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .danger {
    background: var(--danger);
    border-color: var(--danger);
    color: var(--danger-bg);
    font-weight: 600;
  }
  .error {
    color: var(--danger);
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
