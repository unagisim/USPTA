import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { initPwa } from './lib/pwa.svelte';
import { initApp } from './lib/state.svelte';

initPwa();
void initApp();

const app = mount(App, { target: document.getElementById('app')! });

export default app;
