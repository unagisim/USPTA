<script lang="ts">
  import { onMount } from 'svelte';
  import Home from './screens/Home.svelte';
  import NewMatch from './screens/NewMatch.svelte';
  import MatchScreen from './screens/MatchScreen.svelte';
  import SettingsScreen from './screens/SettingsScreen.svelte';

  type Route = { name: 'home' } | { name: 'new' } | { name: 'match'; id: string } | { name: 'settings' };

  let route = $state<Route>({ name: 'home' });

  // Le bouton retour d'Android ramène à l'accueil au lieu de fermer l'application.
  function go(next: Route) {
    if (route.name === 'home' && next.name !== 'home') history.pushState({ app: true }, '');
    if (next.name === 'home' && route.name !== 'home') {
      route = next;
      history.back();
      return;
    }
    route = next;
  }

  onMount(() => {
    const onPop = () => {
      route = { name: 'home' };
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  });
</script>

{#if route.name === 'home'}
  <Home
    onNew={() => go({ name: 'new' })}
    onOpen={(id) => go({ name: 'match', id })}
    onSettings={() => go({ name: 'settings' })}
  />
{:else if route.name === 'new'}
  <NewMatch onCancel={() => go({ name: 'home' })} onCreated={(id) => (route = { name: 'match', id })} />
{:else if route.name === 'settings'}
  <SettingsScreen onBack={() => go({ name: 'home' })} />
{:else}
  {#key route.id}
    <MatchScreen id={route.id} onExit={() => go({ name: 'home' })} />
  {/key}
{/if}
