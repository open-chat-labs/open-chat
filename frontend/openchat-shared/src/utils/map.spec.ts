import type { ChatIdentifier, ChatListScope, MessageContext } from "../domain";
import { ChatListScopeMap, ChatMap, MessageContextMap, SafeMap } from "./map";

describe("safe map from entries", () => {
    test("simple map", () => {
        const map = new Map<string, string>([["hello", "world"]]);
        const safeMap = SafeMap.fromEntries(map.entries());
        expect(safeMap.get("hello")).toEqual("world");
    });
});

const direct: ChatIdentifier = { kind: "direct_chat", userId: "user-1" };
const group: ChatIdentifier = { kind: "group_chat", groupId: "group-1" };
const channel: ChatIdentifier = { kind: "channel", communityId: "comm-1", channelId: 123 };
const chatIds = [direct, group, channel];

const contexts: MessageContext[] = [
    { chatId: direct },
    { chatId: direct, threadRootMessageIndex: 7 },
    { chatId: group },
    { chatId: group, threadRootMessageIndex: 0 },
    { chatId: channel },
    { chatId: channel, threadRootMessageIndex: 42 },
];

const scopes: ChatListScope[] = [
    { kind: "chats" },
    { kind: "favourite" },
    { kind: "none" },
    { kind: "community", id: { kind: "community", communityId: "comm-1" } },
];

function roundTrip<K>(name: string, make: () => SafeMap<K, number>, keys: K[]) {
    describe(name, () => {
        let map: SafeMap<K, number>;
        beforeEach(() => {
            map = make();
            keys.forEach((k, i) => map.set(k, i));
        });

        test("get/has by value not identity", () => {
            keys.forEach((k, i) => {
                const copy = structuredClone(k);
                expect(map.get(copy)).toBe(i);
                expect(map.has(copy)).toBe(true);
            });
            expect(map.size).toBe(keys.length);
        });

        test("entries / keys / iterator / forEach round-trip keys", () => {
            expect([...map.entries()]).toEqual(keys.map((k, i) => [k, i]));
            expect([...map.keys()]).toEqual(keys);
            expect([...map]).toEqual(keys.map((k, i) => [k, i]));
            expect([...map.values()]).toEqual(keys.map((_, i) => i));
            const seen: [K, number][] = [];
            map.forEach((v, k, m) => {
                expect(m).toBe(map);
                seen.push([k, v]);
            });
            expect(seen).toEqual(keys.map((k, i) => [k, i]));
        });

        test("overwrite by value copy keeps size", () => {
            map.set(structuredClone(keys[0]), 99);
            expect(map.size).toBe(keys.length);
            expect(map.get(keys[0])).toBe(99);
        });

        test("delete by value copy", () => {
            expect(map.delete(structuredClone(keys[0]))).toBe(true);
            expect(map.delete(keys[0])).toBe(false);
            expect(map.has(keys[0])).toBe(false);
            expect(map.size).toBe(keys.length - 1);
        });

        test("clone is independent and preserves codec", () => {
            const cloned = map.clone();
            expect([...cloned.entries()]).toEqual([...map.entries()]);
            cloned.set(structuredClone(keys[0]), 100);
            expect(map.get(keys[0])).toBe(0);
            expect(cloned.get(keys[0])).toBe(100);
            expect(cloned.size).toBe(keys.length);
        });

        test("filter / map / reduce / merge / empty", () => {
            const filtered = map.filter((v) => v % 2 === 0);
            expect([...filtered.keys()]).toEqual(keys.filter((_, i) => i % 2 === 0));
            expect(filtered.has(structuredClone(keys[0]))).toBe(true);

            const mapped = map.map((k, v) => `${JSON.stringify(k)}:${v}`);
            expect(mapped.get(structuredClone(keys[1]))).toBe(`${JSON.stringify(keys[1])}:1`);
            expect([...mapped.keys()]).toEqual(keys);

            const total = map.reduce((acc, [k, v], m) => {
                expect(m).toBe(map);
                expect(keys).toContainEqual(k);
                return acc + v;
            }, 0);
            expect(total).toBe(keys.reduce((a, _, i) => a + i, 0));

            const other = make();
            other.set(structuredClone(keys[0]), 50);
            expect(map.merge(other)).toBe(map);
            expect(map.get(keys[0])).toBe(50);
            expect(map.size).toBe(keys.length);

            const empty = map.empty();
            expect(empty.size).toBe(0);
            empty.set(structuredClone(keys[0]), 1);
            expect(empty.has(keys[0])).toBe(true);

            map.clear();
            expect(map.size).toBe(0);
            expect(map.get(keys[0])).toBeUndefined();
        });

        test("toMap keys are strings", () => {
            const raw = map.toMap();
            expect(raw.size).toBe(keys.length);
            for (const [k, v] of raw.entries()) {
                expect(typeof k).toBe("string");
                expect(typeof v).toBe("number");
            }
        });
    });
}

roundTrip("ChatMap", () => new ChatMap<number>(), chatIds);
roundTrip("MessageContextMap", () => new MessageContextMap<number>(), contexts);
roundTrip("ChatListScopeMap", () => new ChatListScopeMap<number>(), scopes);

describe("key collisions", () => {
    test("chat identifier kinds never collide", () => {
        const map = new ChatMap<string>();
        map.set({ kind: "group_chat", groupId: "a" }, "group");
        map.set({ kind: "direct_chat", userId: "a" }, "direct");
        map.set({ kind: "channel", communityId: "a", channelId: 1 }, "channel");
        map.set({ kind: "channel", communityId: "a", channelId: 11 }, "channel11");
        map.set({ kind: "channel", communityId: "a1", channelId: 1 }, "channel-a1");
        expect(map.size).toBe(5);
        expect(map.get({ kind: "group_chat", groupId: "a" })).toBe("group");
        expect(map.get({ kind: "direct_chat", userId: "a" })).toBe("direct");
        expect(map.get({ kind: "channel", communityId: "a", channelId: 1 })).toBe("channel");
        expect(map.get({ kind: "channel", communityId: "a", channelId: 11 })).toBe("channel11");
        expect(map.get({ kind: "channel", communityId: "a1", channelId: 1 })).toBe("channel-a1");
    });

    test("message contexts with and without thread never collide", () => {
        const map = new MessageContextMap<string>();
        map.set({ chatId: group }, "root");
        map.set({ chatId: group, threadRootMessageIndex: 1 }, "t1");
        map.set({ chatId: group, threadRootMessageIndex: 11 }, "t11");
        map.set({ chatId: channel }, "c-root");
        map.set({ chatId: channel, threadRootMessageIndex: 123 }, "c-t123");
        expect(map.size).toBe(5);
        expect(map.get({ chatId: group })).toBe("root");
        expect(map.get({ chatId: group, threadRootMessageIndex: undefined })).toBe("root");
        expect(map.get({ chatId: group, threadRootMessageIndex: 1 })).toBe("t1");
        expect(map.get({ chatId: group, threadRootMessageIndex: 11 })).toBe("t11");
        expect(map.get({ chatId: channel })).toBe("c-root");
        expect(map.get({ chatId: channel, threadRootMessageIndex: 123 })).toBe("c-t123");
    });

    test("scopes never collide", () => {
        const map = new ChatListScopeMap<string>();
        scopes.forEach((s) => map.set(s, s.kind));
        map.set({ kind: "community", id: { kind: "community", communityId: "comm-2" } }, "c2");
        expect(map.size).toBe(5);
        expect(
            map.get({ kind: "community", id: { kind: "community", communityId: "comm-1" } }),
        ).toBe("community");
        expect(
            map.get({ kind: "community", id: { kind: "community", communityId: "comm-2" } }),
        ).toBe("c2");
    });
});

describe("toMap / fromMap round-trip (worker boundary)", () => {
    test("ChatMap", () => {
        const map = new ChatMap<number>();
        chatIds.forEach((k, i) => map.set(k, i));
        const raw = map.toMap() as Map<string, number>;
        const rebuilt = ChatMap.fromMap(raw);
        expect([...rebuilt.entries()]).toEqual([...map.entries()]);
        chatIds.forEach((k, i) => expect(rebuilt.get(structuredClone(k))).toBe(i));
    });

    test("MessageContextMap", () => {
        const map = new MessageContextMap<number>();
        contexts.forEach((k, i) => map.set(k, i));
        const raw = map.toMap() as Map<string, number>;
        const rebuilt = MessageContextMap.fromMap(raw);
        expect([...rebuilt.keys()]).toEqual(contexts);
        contexts.forEach((k, i) => expect(rebuilt.get(structuredClone(k))).toBe(i));
    });
});

describe("timing (informational)", () => {
    test("10k set/get and 5k entries()", () => {
        const ids: ChatIdentifier[] = [];
        for (let i = 0; i < 10_000; i++) {
            ids.push(
                i % 3 === 0
                    ? { kind: "direct_chat", userId: `user-${i}` }
                    : i % 3 === 1
                      ? { kind: "group_chat", groupId: `group-${i}` }
                      : { kind: "channel", communityId: `comm-${i}`, channelId: i },
            );
        }
        const map = new ChatMap<number>();
        const t0 = performance.now();
        for (let r = 0; r < 10; r++) {
            ids.forEach((id, i) => map.set(id, i));
            ids.forEach((id) => map.get(id));
        }
        const t1 = performance.now();
        const small = new ChatMap<number>();
        ids.slice(0, 5000).forEach((id, i) => small.set(id, i));
        let n = 0;
        const t2 = performance.now();
        for (let r = 0; r < 100; r++) {
            for (const [k, v] of small.entries()) {
                if (k.kind === "channel") n += v;
            }
        }
        const t3 = performance.now();
        console.log(
            `ChatMap timing: 10x(10k set + 10k get) = ${(t1 - t0).toFixed(1)}ms; 100x 5k entries() = ${(t3 - t2).toFixed(1)}ms (n=${n})`,
        );
        expect(map.size).toBe(10_000);
    });
});
