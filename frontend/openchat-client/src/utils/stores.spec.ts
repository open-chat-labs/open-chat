import { derived, pauseStores, unpauseStores, writable } from "./stores";
import { derived as svelteDerived, writable as svelteWritable } from "svelte/store";

test("store values match Svelte store values", () => {
    for (const pause of [false, true]) {
        const w1 = writable(1);
        const w2 = writable(1);
        const w3 = writable(1);

        let updateCount = 0;

        const d1 = derived([w1, w2], ([_w1, _w2]) => {
            updateCount++;
            return _w1 * _w2;
        });
        const d2 = derived([w2, w3, d1], ([_w2, _w3, _d1]) => {
            updateCount++;
            return _w2 + _w3 + _d1;
        });
        const d3 = derived(d2, (_d2) => {
            updateCount++;
            return _d2 * 2;
        });

        if (pause) {
            pauseStores();
        }

        const sw1 = svelteWritable(1);
        const sw2 = svelteWritable(1);
        const sw3 = svelteWritable(1);

        let svelteUpdateCount = 0;

        const sd1 = svelteDerived([sw1, sw2], ([_sw1, _sw2]) => {
            svelteUpdateCount++;
            return _sw1 * _sw2;
        });
        const sd2 = svelteDerived([sw2, sw3, sd1], ([_sw2, _sw3, _sd1]) => {
            svelteUpdateCount++;
            return _sw2 + _sw3 + _sd1;
        });
        const sd3 = svelteDerived(sd2, (_sd2) => {
            svelteUpdateCount++;
            return _sd2 * 2;
        });

        const writableStores = [w1, w2, w3];
        const svelteWritableStores = [sw1, sw2, sw3];

        const allStores = [w1, w2, w3, d1, d2, d3];
        const allSvelteStores = [sw1, sw2, sw3, sd1, sd2, sd3];

        // Arrays to hold the values of the stores
        const storeValues: number[] = [];
        const svelteStoreValues: number[] = [];

        // Subscribe to the stores
        for (let i = 0; i < allStores.length; i++) {
            allStores[i].subscribe((v) => storeValues[i] = v);
            allSvelteStores[i].subscribe((v) => svelteStoreValues[i] = v);
        }

        expect(updateCount).toEqual(svelteUpdateCount);

        for (let i = 0; i < 100; i++) {
            const nextStoreIndex = Math.floor(Math.random() * 3);
            const nextValue = Math.random();

            writableStores[nextStoreIndex].set(nextValue);
            svelteWritableStores[nextStoreIndex].set(nextValue);

            if (!pause) {
                expect(updateCount).toEqual(svelteUpdateCount);
            }
        }

        unpauseStores();

        for (let i = 0; i < allStores.length; i++) {
            expect(storeValues[i]).toEqual(svelteStoreValues[i]);
        }

        expect(updateCount).toEqual(pause ? 6 : svelteUpdateCount);
    }
});
