import { describe, expect, test } from "vitest";
import type { ApiListNeuronsResponse } from "./candid/idl";
import { neuronIds } from "./mappers";

const NOW = BigInt(1_000_000) * BigInt(1000);

function response(neurons: ApiListNeuronsResponse["full_neurons"]): ApiListNeuronsResponse {
    return { full_neurons: neurons, total_pages_available: [BigInt(1)] };
}

describe("NNS neuronIds", () => {
    test("keeps neurons which are not dissolved", () => {
        const resp = response([
            { id: [{ id: BigInt(1) }], dissolve_state: [{ DissolveDelaySeconds: BigInt(100) }] },
            {
                id: [{ id: BigInt(2) }],
                dissolve_state: [{ WhenDissolvedTimestampSeconds: BigInt(1_000_001) }],
            },
        ]);
        expect(neuronIds(resp, NOW)).toEqual(["1", "2"]);
    });

    test("drops neurons which are dissolved or have no id", () => {
        const resp = response([
            { id: [{ id: BigInt(1) }], dissolve_state: [{ DissolveDelaySeconds: BigInt(0) }] },
            {
                id: [{ id: BigInt(2) }],
                dissolve_state: [{ WhenDissolvedTimestampSeconds: BigInt(999_999) }],
            },
            { id: [{ id: BigInt(3) }], dissolve_state: [] },
            { id: [], dissolve_state: [{ DissolveDelaySeconds: BigInt(100) }] },
        ]);
        expect(neuronIds(resp, NOW)).toEqual([]);
    });
});
