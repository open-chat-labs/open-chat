import type { NervousSystemFunction } from "@shared";
import { SnsFunctions } from "./snsFunctions.svelte";

const CANISTER = "aaaaa-aa";
const KEY = `sns_functions_${CANISTER}`;

function fn(id: number, name: string): NervousSystemFunction {
    return { id, name, description: `${name} description` };
}

describe("SnsFunctions", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test("get returns undefined for an unknown governance canister", () => {
        const snsFunctions = new SnsFunctions();
        expect(snsFunctions.get(CANISTER)).toBeUndefined();
        expect(snsFunctions.get("unknown-canister")).toBeUndefined();
    });

    test("set makes the functions available keyed by function id", () => {
        const snsFunctions = new SnsFunctions();
        snsFunctions.set(CANISTER, [fn(0, "All"), fn(1, "Motion")]);

        const map = snsFunctions.get(CANISTER);
        expect(map).toBeDefined();
        expect([...map!.keys()]).toEqual([0, 1]);
        expect(map!.get(1)).toEqual(fn(1, "Motion"));
    });

    test("set writes the functions to local storage", () => {
        const snsFunctions = new SnsFunctions();
        snsFunctions.set(CANISTER, [fn(0, "All"), fn(1, "Motion")]);

        const json = localStorage.getItem(KEY);
        expect(json).not.toBeNull();
        expect(JSON.parse(json!)).toEqual([
            [0, fn(0, "All")],
            [1, fn(1, "Motion")],
        ]);
    });

    test("round trip - functions stored by one instance are read back by the next", () => {
        const first = new SnsFunctions();
        first.set(CANISTER, [fn(0, "All"), fn(1, "Motion")]);

        const second = new SnsFunctions();
        expect([...second.get(CANISTER)!]).toEqual([...first.get(CANISTER)!]);
    });

    test("hydrates every cached governance canister found in local storage", () => {
        localStorage.setItem(KEY, JSON.stringify([[0, fn(0, "All")]]));
        localStorage.setItem("sns_functions_other", JSON.stringify([[7, fn(7, "Upgrade")]]));
        localStorage.setItem("unrelated_key", "ignore me");

        const snsFunctions = new SnsFunctions();
        expect(snsFunctions.get(CANISTER)?.get(0)).toEqual(fn(0, "All"));
        expect(snsFunctions.get("other")?.get(7)).toEqual(fn(7, "Upgrade"));
        expect(snsFunctions.get("unrelated_key")).toBeUndefined();
    });

    test("get is pure - it does not read local storage", () => {
        localStorage.setItem(KEY, JSON.stringify([[0, fn(0, "All")]]));
        const snsFunctions = new SnsFunctions();

        const getItem = vi.spyOn(Storage.prototype, "getItem");
        try {
            expect(snsFunctions.get(CANISTER)?.get(0)).toEqual(fn(0, "All"));
            expect(snsFunctions.get("never-seen")).toBeUndefined();
            expect(getItem).not.toHaveBeenCalled();
        } finally {
            getItem.mockRestore();
        }
    });
});
