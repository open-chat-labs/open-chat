import { writable } from "svelte/store";

type ProfileData = Record<string, number[]>;

const { subscribe, update } = writable<ProfileData>({});

export const profileStore = {
    subscribe,
    capture: (key: string, val: number): void =>
        update((data) => {
            const currentStream = data[key] ?? [];
            const newStream = [...currentStream, val];
            if (newStream.length > 11) {
                newStream.shift();
            }
            return {
                ...data,
                [key]: newStream,
            };
        }),
};
