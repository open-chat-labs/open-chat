import { derived, pauseStores, unpauseStores, writable } from "./stores";
import { derived as svelteDerived, writable as svelteWritable } from "svelte/store";

test("store values match Svelte store values", () => {
    for (const pause in [true, false]) {
        const w1 = writable(0);
        const w2 = writable(0);
        const w3 = writable(0);

        const d1 = derived([w1, w2], ([_w1, _w2]) => _w1 * _w2);
        const d2 = derived([w2, w3, d1], ([_w2, _w3, _d1]) => _w2 + _w3 + _d1);

        if (pause) {
            pauseStores();
        }

        const sw1 = svelteWritable(0);
        const sw2 = svelteWritable(0);
        const sw3 = svelteWritable(0);

        const sd1 = svelteDerived([sw1, sw2], ([_sw1, _sw2]) => _sw1 * _sw2);
        const sd2 = svelteDerived([sw2, sw3, sd1], ([_sw2, _sw3, _sd1]) => _sw2 + _sw3 + _sd1);

        const writableStores = [w1, w2, w3];
        const svelteWritableStores = [sw1, sw2, sw3];

        const allStores = [w1, w2, w3, d1, d2];
        const allSvelteStores = [sw1, sw2, sw3, sd1, sd2];

        for (let i = 0; i < 20; i++) {
            const nextStoreIndex = Math.floor(Math.random() * 3);
            const nextValue = Math.random();

            writableStores[nextStoreIndex].set(nextValue);
            svelteWritableStores[nextStoreIndex].set(nextValue);
        }

        unpauseStores();

        for (let i = 0; i < allStores.length; i++) {
            let value = 0;
            allStores[i].subscribe((v) => value = v);
            expect(value).toBeGreaterThan(0);

            let svelteValue = 0;
            allSvelteStores[i].subscribe((v) => svelteValue = v);
            expect(value).toEqual(svelteValue);
        }
    }
});
