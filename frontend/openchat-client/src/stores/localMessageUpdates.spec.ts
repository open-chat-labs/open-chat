import { MessageMap, type TipsReceived } from "openchat-shared";
import { mergeLocalTips } from "../utils/chat";
import { LocalMessageUpdatesStore } from "./localMessageUpdates";
import { get } from "svelte/store";

type Message = {
    tips: TipsReceived;
};

describe("adding tips locally", () => {
    let updates = new LocalMessageUpdatesStore(new MessageMap());
    beforeEach(() => {
        updates = new LocalMessageUpdatesStore(new MessageMap());
    });

    test("add a local tip", () => {
        updates.markTip(123n, "ledger1", "user1", 456n);
        const store = get(updates);
        const tips = store.get(BigInt(123))?.tips;
        expect(tips).toMatchObject({
            ledger1: {
                user1: 456n,
            },
        });
    });

    test("adding two local tips on the same ledger", () => {
        updates.markTip(123n, "ledger1", "user1", 456n);
        updates.markTip(123n, "ledger1", "user1", 100n);
        const store = get(updates);
        const tips = store.get(BigInt(123))?.tips;
        expect(tips).toMatchObject({
            ledger1: {
                user1: 556n,
            },
        });
    });

    test("adding two local tips on the different ledger", () => {
        updates.markTip(123n, "ledger1", "user1", 456n);
        updates.markTip(123n, "ledger2", "user1", 100n);
        const store = get(updates);
        const tips = store.get(BigInt(123))?.tips;
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
        updates.markTip(123n, "ledger1", "user1", 456n);
        updates.markTip(123n, "ledger1", "user1", -456n);
        const store = get(updates);
        const tips = store.get(BigInt(123))?.tips;
        expect(tips).toMatchObject({});
    });
});

describe("merging local tips", () => {
    test("no existing local updates", () => {
        const existing: Message = { tips: {} };
        const local = { ledger1: { user1: 123n } };
        const merged = mergeLocalTips(existing.tips, local);
        expect(merged).toMatchObject(local);
    });
    test("adding nothing leaves things unchanged", () => {
        const existing: Message = { tips: { ledger1: { user1: 123n } } };
        const local = {};
        const merged = mergeLocalTips(existing.tips, local);
        expect(merged).toMatchObject({
            ledger1: { user1: 123n },
        });
    });
    test("local tip should override existing", () => {
        const existing: Message = { tips: { ledger1: { user1: 123n } } };
        const local = { ledger1: { user1: 456n } };
        const merged = mergeLocalTips(existing.tips, local);
        expect(merged).toMatchObject({
            ledger1: { user1: 456n },
        });
    });
    test("adding a second local update for a different ledger", () => {
        const existing: Message = { tips: { ledger1: { user1: 123n } } };
        const local = { ledger2: { user2: BigInt(456) } };
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
