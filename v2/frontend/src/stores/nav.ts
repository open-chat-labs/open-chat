import { writable } from 'svelte/store';

const { subscribe, set } = writable(false);

export const navStore = {
    subscribe,
    showRight: (): void => set(true),
    hideRight: (): void => set(false),
}