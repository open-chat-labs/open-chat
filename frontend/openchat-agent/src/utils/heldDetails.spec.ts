import { afterEach, describe, expect, test, vi } from "vitest";
import { confirmHeldDetails, type DetailsUpdatesOutcome } from "./heldDetails";

function updatesSince(outcome: DetailsUpdatesOutcome) {
    return vi.fn((_since: bigint) => Promise.resolve(outcome));
}

describe("confirmHeldDetails", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test("details already as new as the summary are good without asking the canister", async () => {
        const query = updatesSince({ kind: "success" });

        expect(await confirmHeldDetails(10n, 10n, query)).toEqual(10n);
        expect(query).not.toHaveBeenCalled();
    });

    test("details are kept as they are while offline", async () => {
        vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
        const query = updatesSince({ kind: "success" });

        expect(await confirmHeldDetails(10n, 20n, query)).toEqual(10n);
        expect(query).not.toHaveBeenCalled();
    });

    test("unchanged details are good up to the canister's timestamp", async () => {
        const query = updatesSince({ kind: "success_no_updates", timestamp: 20n });

        expect(await confirmHeldDetails(10n, 20n, query)).toEqual(20n);
        expect(query).toHaveBeenCalledWith(10n);
    });

    test("a lagging replica's timestamp doesn't move the details backwards", async () => {
        const query = updatesSince({ kind: "success_no_updates", timestamp: 5n });

        expect(await confirmHeldDetails(10n, 20n, query)).toEqual(10n);
    });

    test("details are kept as they are if the canister can't be reached", async () => {
        const query = updatesSince({ kind: "failure" });

        expect(await confirmHeldDetails(10n, 20n, query)).toEqual(10n);
    });

    test("changed details must be loaded in full", async () => {
        const query = updatesSince({ kind: "success" });

        expect(await confirmHeldDetails(10n, 20n, query)).toBeUndefined();
    });
});
