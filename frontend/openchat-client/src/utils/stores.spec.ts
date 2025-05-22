import { derived, withPausedStores, writable } from "./stores";
import { derived as svelteDerived, writable as svelteWritable } from "svelte/store";

describe("store values match Svelte store values", () => {
    test("with nested derived stores", () => {
        for (const pause of [false, true]) {
            // Create writable and derived stores using our custom implementation
            const w1 = writable(1);
            const w2 = writable(1);
            const w3 = writable(1);

            let derivedStoreUpdateCount = 0;

            const d1 = derived([w1, w2], ([_w1, _w2]) => {
                derivedStoreUpdateCount++;
                return _w1 * _w2;
            });
            const d2 = derived([w2, w3, d1], ([_w2, _w3, _d1]) => {
                derivedStoreUpdateCount++;
                return _w2 + _w3 + _d1;
            });
            const d3 = derived(d2, (_d2) => {
                derivedStoreUpdateCount++;
                return _d2 * 2;
            });
            const d4 = derived([w1, w2, w3, d1, d2, d3], ([_w1, _w2, _w3, _d1, _d2, _d3]) => {
                derivedStoreUpdateCount++;
                return _w1 * _w2 * _w3 * _d1 * _d2 * _d3;
            });

            // Create matching writable and derived stores using Svelte's implementation
            const sw1 = svelteWritable(1);
            const sw2 = svelteWritable(1);
            const sw3 = svelteWritable(1);

            let svelteDerivedStoreUpdateCount = 0;

            const sd1 = svelteDerived([sw1, sw2], ([_sw1, _sw2]) => {
                svelteDerivedStoreUpdateCount++;
                return _sw1 * _sw2;
            });
            const sd2 = svelteDerived([sw2, sw3, sd1], ([_sw2, _sw3, _sd1]) => {
                svelteDerivedStoreUpdateCount++;
                return _sw2 + _sw3 + _sd1;
            });
            const sd3 = svelteDerived(sd2, (_sd2) => {
                svelteDerivedStoreUpdateCount++;
                return _sd2 * 2;
            });
            const sd4 = svelteDerived([sw1, sw2, sw3, sd1, sd2, sd3], ([_sw1, _sw2, _sw3, _sd1, _sd2, _sd3]) => {
                svelteDerivedStoreUpdateCount++;
                return _sw1 * _sw2 * _sw3 * _sd1 * _sd2 * _sd3;
            });

            const writableStores = [w1, w2, w3];
            const svelteWritableStores = [sw1, sw2, sw3];

            const allStores = [w1, w2, w3, d1, d2, d3, d4];
            const allSvelteStores = [sw1, sw2, sw3, sd1, sd2, sd3, sd4];

            // Arrays to hold the values of the stores
            const storeValues: number[] = [];
            const svelteStoreValues: number[] = [];

            // Subscribe to the stores
            for (let i = 0; i < allStores.length; i++) {
                allStores[i].subscribe((v) => storeValues[i] = v);
                allSvelteStores[i].subscribe((v) => svelteStoreValues[i] = v);
            }

            // After initialization, each store should have been updated exactly once
            expect(derivedStoreUpdateCount).toEqual(svelteDerivedStoreUpdateCount);

            const updateStores = () => {
                // Randomly update both sets of stores
                for (let i = 0; i < 100; i++) {
                    const nextStoreIndex = Math.floor(Math.random() * 3);
                    const nextValue = Math.random();

                    writableStores[nextStoreIndex].set(nextValue);
                    svelteWritableStores[nextStoreIndex].set(nextValue);

                    if (!pause) {
                        // If our stores are not paused, then they should be updated exactly as frequently as the Svelte stores
                        expect(derivedStoreUpdateCount).toEqual(svelteDerivedStoreUpdateCount);
                    }
                }
            }

            if (pause) {
                withPausedStores(updateStores);
            } else {
                updateStores();
            }

            // Check that the values in our stores match the values in the Svelte stores
            for (let i = 0; i < allStores.length; i++) {
                expect(storeValues[i]).toEqual(svelteStoreValues[i]);
            }

            if (pause) {
                // If our stores were paused then they should have been updated twice, once when they were initialized and
                // once after they were unpaused.
                expect(derivedStoreUpdateCount).toEqual(pause ? 8 : svelteDerivedStoreUpdateCount);
            }
        }
    });

    test("when dependent derived store output remains the same as input changes", () => {
        const w = writable(1);
        const d1 = derived(w, (_w) => _w < 5);
        const d2 = derived(d1, (_d1) => _d1);
        const d3 = derived([w, d2], ([_w, _d2]) => _w + (_d2 ? 1 : 0));
        d3.subscribe(_ => {});
        w.set(2);
        expect(d3.value).toEqual(3);
    });
});

describe("store value can be accessed", () => {
    test("when store has subscribers", () => {
        const w = writable(1);
        const d = derived(w, (_w) => 2 * _w);
        d.subscribe((_) => {});
        expect(d.value).toEqual(2);
    });

    test("when store has no subscribers", () => {
        const w = writable(1);
        const d = derived(w, (_w) => 2 * _w);
        expect(d.value).toEqual(2);
    });

    test("when store has no subscribers and stores are paused", () => {
        const w = writable(1);
        const d = derived(w, (_w) => 2 * _w);

        withPausedStores(() => {
            expect(d.value).toEqual(2);
        });
    });

    test("when store is in chain of derived stores with no subscribers and stores are paused", () => {
        const w = writable(1);
        const d1 = derived(w, (_w) => 2 * _w);
        const d2 = derived(d1, (_d1) => 3 * _d1);
        const d3 = derived(d2, (_d2) => 4 * _d2);

        withPausedStores(() => {
            expect(d3.value).toEqual(24);
        });
    });

    test("when store has no subscribers and depends on dirty derived stores", () => {
        const w1 = writable(1);
        const w2 = writable(2);
        const d1 = derived(w1, (_w1) => _w1);
        const d2 = derived(w2, (_w2) => _w2);
        const d3 = derived([d1, d2], ([_d1, _d2]) => _d1 * _d2);
        d1.subscribe((_) => {});
        d2.subscribe((_) => {});

        withPausedStores(() => {
            w1.set(3);
            w2.set(4);
            // It won't pick up the new values since stores are paused
            expect(d3.value).toEqual(2);
        });
    });
});
