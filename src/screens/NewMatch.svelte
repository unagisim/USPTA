<script lang="ts">
  import { DEFAULT_COLORS } from '../lib/colors';
  import { saveMatch, SURFACES, uid, type MatchInfo } from '../lib/db';
  import { FORMAT_LIST, type BallChange, type FormatId, type Player } from '../lib/engine';

  let { onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void } = $props();

  const emptyPlayer = (): Player => ({ civility: 'M.', firstName: '', lastName: '', club: '', ranking: '' });

  let info = $state<MatchInfo>({ tournament: '', round: '', court: '', referee: '', umpire: '', umpireLicence: '', team: false, surface: 'clay', lineJudges: false, ballKids: false });
  let players = $state({ A: emptyPlayer(), B: emptyPlayer() });
  let partners = $state({ A: emptyPlayer(), B: emptyPlayer() });
  let doubles = $state(false);
  let formatId = $state<FormatId>('F2');
  let ballMode = $state<BallChange['mode']>('none');
  let error = $state('');

  // Arbitre : on reprend le dernier nom saisi sur cet appareil.
  try {
    const last = JSON.parse(localStorage.getItem('uspta.umpire') ?? 'null') as { umpire: string; umpireLicence: string } | null;
    if (last) Object.assign(info, last);
  } catch {
    // Stockage indisponible : rien à reprendre.
  }

  async function create() {
    if (!players.A.lastName.trim() || !players.B.lastName.trim()) {
      error = doubles ? 'Indiquez au moins le nom des quatre joueurs.' : 'Indiquez au moins le nom des deux joueurs.';
      return;
    }
    if (doubles && (!partners.A.lastName.trim() || !partners.B.lastName.trim())) {
      error = 'Indiquez au moins le nom des quatre joueurs.';
      return;
    }
    if (info.team && (!players.A.club?.trim() || !players.B.club?.trim())) {
      error = 'Match par équipes : indiquez le club des deux joueurs, il sert aux annonces du score.';
      return;
    }
    const balls: BallChange =
      ballMode === 'regulation'
        ? { mode: 'regulation', first: 7, every: 9, warmupGames: 2 }
        : ballMode === 'final_set'
          ? { mode: 'final_set' }
          : { mode: 'none' };
    const id = uid();
    await saveMatch({
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      info,
      players,
      ...(doubles ? { doubles: true, partners, serveOrder: { A: 0, B: 0 } } : {}),
      formatId,
      balls,
      firstServer: 'A',
      leftAtStart: 'A',
      toss: null,
      colors: { ...DEFAULT_COLORS },
      checklist: {},
      events: [],
      phase: 'prematch',
      winner: null,
    });
    try {
      localStorage.setItem('uspta.umpire', JSON.stringify({ umpire: info.umpire, umpireLicence: info.umpireLicence }));
    } catch {
      // Sans stockage, le nom de l'arbitre sera à ressaisir.
    }
    onCreated(id);
  }
</script>

<div class="page">
  <div class="topbar">
    <button class="ghost" onclick={onCancel}>← Retour</button>
    <h1>Nouveau match</h1>
  </div>

  <div class="card stack">
    <h2>Match</h2>
    <div>
      <label for="t">Compétition ou épreuve</label>
      <input id="t" bind:value={info.tournament} placeholder="Open de Blagnac, championnat par équipes National 3…" />
    </div>
    <div class="grid2">
      <div>
        <label for="tr">Tour, poule ou journée</label>
        <input id="tr" bind:value={info.round} placeholder="1/4 de finale, poule B, 3e journée…" />
      </div>
      <div><label for="c">Court</label><input id="c" bind:value={info.court} /></div>
    </div>
    <p class="muted hint">Ces deux champs ouvrent la présentation du match : « 3e journée, championnat par équipes National 3, opposant… ».</p>
    <label class="check">
      <input type="checkbox" bind:checked={info.team} />
      Match par équipes : le score s'annonce avec le nom du club
    </label>
    <div>
      <label for="sf">Surface</label>
      <select id="sf" bind:value={info.surface}>
        {#each SURFACES as [v, l] (v)}<option value={v}>{l}</option>{/each}
      </select>
    </div>
    <label class="check"><input type="checkbox" bind:checked={info.lineJudges} /> Juges de ligne présents</label>
    <label class="check"><input type="checkbox" bind:checked={info.ballKids} /> Ramasseurs de balles présents</label>
    <div><label for="ja">Juge-arbitre</label><input id="ja" bind:value={info.referee} /></div>
    <div class="grid2">
      <div><label for="u">Arbitre</label><input id="u" bind:value={info.umpire} /></div>
      <div><label for="ul">N° de licence</label><input id="ul" bind:value={info.umpireLicence} /></div>
    </div>
  </div>

  <div class="seg kind">
    <button aria-pressed={!doubles} onclick={() => (doubles = false)}>Simple</button>
    <button aria-pressed={doubles} onclick={() => (doubles = true)}>Double</button>
  </div>

  {#snippet playerFields(p: Player, id: string)}
    <div class="seg">
      <button aria-pressed={p.civility === 'M.'} onclick={() => (p.civility = 'M.')}>M.</button>
      <button aria-pressed={p.civility === 'Mme'} onclick={() => (p.civility = 'Mme')}>Mme</button>
      <button aria-pressed={p.civility === 'Mlle'} onclick={() => (p.civility = 'Mlle')}>Mlle</button>
    </div>
    <div class="grid2">
      <div><label for="fn{id}">Prénom</label><input id="fn{id}" bind:value={p.firstName} autocapitalize="words" /></div>
      <div><label for="ln{id}">Nom</label><input id="ln{id}" bind:value={p.lastName} autocapitalize="characters" /></div>
    </div>
    <div class="grid2">
      <div><label for="cl{id}">Club</label><input id="cl{id}" bind:value={p.club} /></div>
      <div><label for="rk{id}">Classement</label><input id="rk{id}" bind:value={p.ranking} /></div>
    </div>
  {/snippet}

  {#each ['A', 'B'] as const as side (side)}
    <div class="card stack">
      <h2>{doubles ? `Équipe ${side === 'A' ? 1 : 2}` : `Joueur ${side === 'A' ? 1 : 2}`}</h2>
      {#if doubles}<h3>Premier joueur</h3>{/if}
      {@render playerFields(players[side], side)}
      {#if doubles}
        <h3>Partenaire</h3>
        {@render playerFields(partners[side], `${side}2`)}
      {/if}
    </div>
  {/each}

  <div class="card stack">
    <h2>Format</h2>
    <select bind:value={formatId} aria-label="Format">
      {#each FORMAT_LIST as f (f.id)}
        <option value={f.id}>{f.label} : {f.description}</option>
      {/each}
    </select>
    <div>
      <label for="balls">Balles neuves</label>
      <select id="balls" bind:value={ballMode}>
        <option value="none">Pas de changement</option>
        <option value="regulation">Changements réglementaires (7 puis 9 jeux)</option>
        <option value="final_set">Pour la 3e manche</option>
      </select>
    </div>
  </div>

  {#if error}<p class="notice">{error}</p>{/if}
  <button class="primary wide" onclick={create}>Continuer vers l'avant-match</button>
</div>

<style>
  .kind {
    margin: 4px 0 12px;
  }
  h3 {
    font-size: 14px;
    margin: 6px 0 0;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    color: var(--text);
  }
  .check input {
    width: 24px;
    min-height: 24px;
    flex: none;
  }
  .hint {
    font-size: 13px;
    margin: 0;
  }
  .wide {
    width: 100%;
    margin-top: 4px;
  }
</style>
