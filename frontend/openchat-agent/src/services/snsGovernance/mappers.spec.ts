import { describe, expect, test } from "vitest";
import type { ApiListNeuronsResponse } from "./candid/idl";
import { neuronIds } from "./mappers";

const NOW = BigInt(1_000_000) * BigInt(1000);

describe("SNS neuronIds", () => {
    test("keeps the subaccounts of neurons which are not dissolved", () => {
        const resp: ApiListNeuronsResponse = {
            neurons: [
                {
                    id: [{ id: [1, 2, 3] }],
                    dissolve_state: [{ DissolveDelaySeconds: BigInt(100) }],
                },
                {
                    id: [{ id: new Uint8Array([4, 5]) }],
                    dissolve_state: [{ WhenDissolvedTimestampSeconds: BigInt(1_000_001) }],
                },
            ],
        };
        expect(neuronIds(resp, NOW)).toEqual([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])]);
    });

    test("drops neurons which are dissolved or have no id", () => {
        const resp: ApiListNeuronsResponse = {
            neurons: [
                { id: [{ id: [1] }], dissolve_state: [{ DissolveDelaySeconds: BigInt(0) }] },
                {
                    id: [{ id: [2] }],
                    dissolve_state: [{ WhenDissolvedTimestampSeconds: BigInt(999_999) }],
                },
                { id: [{ id: [3] }], dissolve_state: [] },
                { id: [], dissolve_state: [{ DissolveDelaySeconds: BigInt(100) }] },
            ],
        };
        expect(neuronIds(resp, NOW)).toEqual([]);
    });
});
