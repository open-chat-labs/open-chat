import { type TipsReceived } from "openchat-shared";
import { SvelteMap } from "svelte/reactivity";
import { mergeLocalTips } from "../utils/chat";
import { localUpdates } from "./localUpdates";
import { messageLocalUpdates, type LocalTipsReceived } from "./message/localUpdates";

type Message = {
    tips: TipsReceived;
};

describe("adding tips locally", () => {
    beforeEach(() => {
        localUpdates.clearAll();
    });

    test("add a local tip", () => {
        localUpdates.markTip(123n, "ledger1", "user1", 456n);
        const tips = messageLocalUpdates.value.get(BigInt(123))?.tips;
        expect(tips?.get("ledger1")?.get("user1")).toEqual(456n);
    });

    test("adding two local tips on the same ledger", () => {
        localUpdates.markTip(123n, "ledger1", "user1", 456n);
        localUpdates.markTip(123n, "ledger1", "user1", 100n);
        const tips = messageLocalUpdates.value.get(BigInt(123))?.tips;
        expect(tips?.get("ledger1")?.get("user1")).toEqual(556n);
    });

    test("adding two local tips on the different ledger", () => {
        localUpdates.markTip(123n, "ledger1", "user1", 456n);
        localUpdates.markTip(123n, "ledger2", "user1", 100n);
        const tips = messageLocalUpdates.value.get(BigInt(123))?.tips;
        expect(tips?.get("ledger1")?.get("user1")).toEqual(456n);
        expect(tips?.get("ledger2")?.get("user1")).toEqual(100n);
    });

    test("reverting a tip", () => {
        localUpdates.markTip(123n, "ledger1", "user1", 456n);
        localUpdates.markTip(123n, "ledger1", "user1", -456n);
        const tips = messageLocalUpdates.value.get(BigInt(123))?.tips;
        expect(tips?.get("ledger1")).toBeUndefined();
    });
});

describe("merging local tips", () => {
    beforeEach(() => {
        localUpdates.clearAll();
    });
    test("no existing local updates", () => {
        const existing: Message = { tips: {} };
        const local = createLocalTips("ledger1", "user1", 123n);
        const merged = mergeLocalTips(existing.tips, local);
        expect(merged).toMatchObject(local);
    });
    test("adding nothing leaves things unchanged", () => {
        const existing: Message = { tips: { ledger1: { user1: 123n } } };
        const local = new Map() as LocalTipsReceived;
        const merged = mergeLocalTips(existing.tips, local);
        expect(merged).toMatchObject({
            ledger1: { user1: 123n },
        });
    });
    test("local tip should override existing", () => {
        const existing: Message = { tips: { ledger1: { user1: 123n } } };
        const local = createLocalTips("ledger1", "user1", 456n);
        const merged = mergeLocalTips(existing.tips, local);
        expect(merged).toMatchObject({
            ledger1: { user1: 456n },
        });
    });
    test("adding a second local update for a different ledger", () => {
        const existing: Message = { tips: { ledger1: { user1: 123n } } };
        const local = createLocalTips("ledger2", "user2", 456n);
        const merged = mergeLocalTips(existing.tips, local);
        expect(merged).toMatchObject({
            ledger1: {
                user1: 123n,
            },
            ledger2: {
                user2: 456n,
            },
        });
    });
});

function createLocalTips(ledger: string, userId: string, amount: bigint): LocalTipsReceived {
    const ledgers = new SvelteMap<string, SvelteMap<string, bigint>>();
    const users = new SvelteMap<string, bigint>();
    users.set(userId, amount);
    ledgers.set(ledger, users);
    return ledgers;
}
