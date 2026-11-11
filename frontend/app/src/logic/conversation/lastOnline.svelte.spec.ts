import type { MessageFormatter, UserSummary } from "@client";
import { flushSync, tick } from "svelte";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LastOnline } from "./lastOnline.svelte";

const MINUTE = 60_000;
const NOW = 100 * MINUTE;

// the message key, and the duration where there is one
const formatter: MessageFormatter = (id, options) =>
    options?.values?.duration !== undefined ? `${id}:${options.values.duration}` : id;

type Pending = {
    userId: string;
    now: number;
    resolve: (at: number | undefined) => void;
    reject: (err: Error) => void;
};

// getLastOnlineDate as the client has it, answered by the test in any order
function fakeClient() {
    const pending: Pending[] = [];
    const getLastOnlineDate = vi.fn(
        (userId: string, now: number) =>
            new Promise<number | undefined>((resolve, reject) =>
                pending.push({ userId, now, resolve, reject }),
            ),
    );
    return { getLastOnlineDate, pending };
}

async function settle() {
    flushSync();
    await tick();
    flushSync();
}

// builds it inside an effect root, as a component would, with sources the test changes
function lastOnline(
    initial: { userId?: string; user?: Pick<UserSummary, "kind" | "suspended"> } = {
        userId: "alice",
        user: { kind: "user", suspended: false },
    },
) {
    const client = fakeClient();
    const sources = $state({ ...initial, now: NOW });
    let state!: LastOnline;
    const stop = $effect.root(() => {
        state = new LastOnline(client, {
            userId: () => sources.userId,
            user: () => sources.user,
            now: () => sources.now,
            formatter: () => formatter,
        });
    });
    flushSync();
    return { state, client, sources, stop };
}

let stops: (() => void)[] = [];
afterEach(() => {
    stops.forEach((stop) => stop());
    stops = [];
    vi.restoreAllMocks();
});

describe("a DM's last online line", () => {
    test("says when they were last online once it's known, and asks again on each tick", async () => {
        const { state, client, sources, stop } = lastOnline();
        stops.push(stop);
        expect(state.text).toBe("");
        expect(client.getLastOnlineDate).toHaveBeenCalledWith("alice", NOW);

        client.pending[0].resolve(NOW - MINUTE);
        await settle();
        expect(state.text).toBe("onlineNow");
        expect(state.online).toBe(true);

        sources.now = NOW + 10 * MINUTE;
        await settle();
        expect(client.getLastOnlineDate).toHaveBeenLastCalledWith("alice", NOW + 10 * MINUTE);
        // the clock moves the line before the answer is in
        expect(state.text).toBe("lastOnline:durationMins:11");
        expect(state.online).toBe(false);
    });

    test("never shows another DM's: a new DM starts empty, and the old one's late answer is ignored", async () => {
        const { state, client, sources, stop } = lastOnline();
        stops.push(stop);
        client.pending[0].resolve(NOW - MINUTE);
        await settle();
        expect(state.text).toBe("onlineNow");

        // alice asked again, then on to bob before either answer is in
        sources.now = NOW + 5_000;
        await settle();
        sources.userId = "bob";
        await settle();
        expect(state.text).toBe("");

        client.pending[1].resolve(NOW);
        await settle();
        expect(state.text).toBe("");

        client.pending[2].resolve(NOW - 30 * MINUTE);
        await settle();
        expect(state.text).toBe("lastOnline:durationMins:30");
    });

    test("drops an answer older than the one already taken", async () => {
        const { state, client, sources, stop } = lastOnline();
        stops.push(stop);
        sources.now = NOW + 5_000;
        await settle();
        expect(client.pending).toHaveLength(2);

        client.pending[1].resolve(NOW);
        await settle();
        expect(state.text).toBe("onlineNow");

        client.pending[0].resolve(NOW - 60 * MINUTE);
        await settle();
        expect(state.text).toBe("onlineNow");
    });

    test("a failed lookup keeps what was known, and rejects nothing", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const { state, client, sources, stop } = lastOnline();
        stops.push(stop);
        client.pending[0].resolve(NOW - MINUTE);
        await settle();

        sources.now = NOW + 5_000;
        await settle();
        client.pending[1].reject(new Error("worker gone"));
        await settle();
        expect(state.text).toBe("onlineNow");
        expect(warn).toHaveBeenCalled();
    });

    test("doesn't ask for a bot, a suspended account or a chat that isn't a DM", () => {
        const bot = lastOnline({ userId: "bot", user: { kind: "bot", suspended: false } });
        const suspended = lastOnline({ userId: "eve", user: { kind: "user", suspended: true } });
        const group = lastOnline({});
        stops.push(bot.stop, suspended.stop, group.stop);

        expect(bot.state.text).toBe("");
        expect(suspended.state.text).toBe("accountSuspended");
        expect(group.state.text).toBe("");
        for (const { client } of [bot, suspended, group]) {
            expect(client.getLastOnlineDate).not.toHaveBeenCalled();
        }
    });
});
