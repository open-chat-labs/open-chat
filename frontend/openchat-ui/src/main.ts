import { mount } from 'svelte';
import './lib/styles/tokens.css';
import './lib/styles/global.css';
import './lib/behaviours/a11y.js';
import './lib/behaviours/tooltip.js';
import Docs from './docs/Docs.svelte';

mount(Docs, { target: document.getElementById('app')! });
