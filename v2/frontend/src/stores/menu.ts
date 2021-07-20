import { writable } from "svelte/store";

const { subscribe, update } = writable<HTMLElement | undefined>(undefined);

export const menuStore = {
    subscribe,
    showMenu: (menu: HTMLElement): void => update(() => menu),
    hideMenu: (): void => update(() => undefined),
};
