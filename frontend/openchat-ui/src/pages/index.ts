// OpenChat pages: whole screens a route mounts directly, outside the app shell (Landing, Learn). Each is its own theme
// root and takes the host's routes and auth callbacks as props.
import { installBehaviours } from '../lib/behaviours';

installBehaviours();

export { default as Landing } from './Landing.svelte';
export { default as Learn } from './Learn.svelte';
export type { PageAuth } from './pageAuth.svelte';
export type { HeroStyle } from './heroBackground';
export { LEARN_PAGES, learnFromHash, learnHashHref, placeholderLearnContent } from './learnContent';
export type { FaqGroup, LearnContent, LearnDoc, LearnDocPage, LearnDocSection, LearnPage, LearnPost, RoadmapItem } from './learnContent';
export { PAGE_ACCENTS } from './types';
export type { LandingCommunity, PageAccent, PageMode } from './types';
