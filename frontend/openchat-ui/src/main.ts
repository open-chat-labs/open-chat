import { mount } from 'svelte';
import './lib/styles/tokens.css';
import './lib/styles/global.css';
import { installBehaviours } from './lib/behaviours';
import Docs from './docs/Docs.svelte';

installBehaviours();
mount(Docs, { target: document.getElementById('app')! });
