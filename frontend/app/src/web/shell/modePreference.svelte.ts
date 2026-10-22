import { LocalStorageBoolStore } from "@client";

// A shell preference kept across visits (localStorage), but only in the mode where it is one: the
// right column docked, the rail pushing the layout. Set in another mode, it's left alone. Other
// open tabs follow a change (the browser's storage event). Create it while a component
// initialises: it listens for as long as that component lives.
export class ModePreference {
    #stored: LocalStorageBoolStore;
    #value = $state(false);
    #remembers: () => boolean;

    constructor(key: string, fallback: boolean, remembers: () => boolean) {
        this.#stored = new LocalStorageBoolStore(key, fallback);
        this.#value = this.#stored.value;
        this.#remembers = remembers;
        $effect(() => {
            const changed = (e: StorageEvent) => {
                if (e.key === key && e.newValue !== null) this.#value = e.newValue === "true";
            };
            window.addEventListener("storage", changed);
            return () => window.removeEventListener("storage", changed);
        });
    }

    get value(): boolean {
        return this.#value;
    }

    set value(value: boolean) {
        if (!this.#remembers()) return;
        this.#value = value;
        this.#stored.set(value);
    }
}
