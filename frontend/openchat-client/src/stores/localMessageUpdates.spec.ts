import { type TipsReceived } from "openchat-shared";
import { SvelteMap } from "svelte/reactivity";
import { messageLocalUpdates, type LocalTipsReceived } from "../state/message/local.svelte";
import { mergeLocalTips } from "../utils/chat";

type Message = {
    tips: TipsReceived;
};

describe("adding tips locally", () => {
    beforeEach(() => {
        messageLocalUpdates.clearAll();
    });

    test("add a local tip", () => {
        messageLocalUpdates.markTip(123n, "ledger1", "user1", 456n);
        const tips = messageLocalUpdates.get(BigInt(123))?.tips;
        expect(tips).toMatchObject({
            ledger1: {
                user1: 456n,
            },
        });
    });

    test("adding two local tips on the same ledger", () => {
        messageLocalUpdates.markTip(123n, "ledger1", "user1", 456n);
        messageLocalUpdates.markTip(123n, "ledger1", "user1", 100n);
        const tips = messageLocalUpdates.get(BigInt(123))?.tips;
        expect(tips).toMatchObject({
            ledger1: {
                user1: 556n,
            },
        });
    });

    test("adding two local tips on the different ledger", () => {
        messageLocalUpdates.markTip(123n, "ledger1", "user1", 456n);
        messageLocalUpdates.markTip(123n, "ledger2", "user1", 100n);
        const tips = messageLocalUpdates.get(BigInt(123))?.tips;
        expect(tips).toMatchObject({
            ledger1: {
                user1: 456n,
            },
            ledger2: {
                user1: 100n,
            },
        });
    });

    test("reverting a tip", () => {
        messageLocalUpdates.markTip(123n, "ledger1", "user1", 456n);
        messageLocalUpdates.markTip(123n, "ledger1", "user1", -456n);
        const tips = messageLocalUpdates.get(BigInt(123))?.tips;
        expect(tips).toMatchObject({});
    });
});

describe("merging local tips", () => {
    beforeEach(() => {
        messageLocalUpdates.clearAll();
    });
    test("no existing local updates", () => {
        const existing: Message = { tips: {} };
        const local = createLocalTips("ledger1", "user1", 123n);
        const merged = mergeLocalTips(existing.tips, local);
        expect(merged).toMatchObject(local);
    });
    test("adding nothing leaves things unchanged", () => {
        const existing: Message = { tips: { ledger1: { user1: 123n } } };
        const local = new SvelteMap() as LocalTipsReceived;
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
