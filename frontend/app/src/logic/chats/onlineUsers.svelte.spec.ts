import { UserStatus } from "@client";
import { describe, expect, test, vi } from "vitest";
import { OnlineUsers } from "./onlineUsers.svelte";

describe("OnlineUsers", () => {
    test("holds the users who are online", async () => {
        const status = vi.fn(async (userId: string) =>
            userId === "alice" ? UserStatus.Online : UserStatus.Offline,
        );
        const users = new OnlineUsers(status);
        await users.refresh(["alice", "bob"], 1000);
        expect([...users.online]).toEqual(["alice"]);
        expect(status).toHaveBeenCalledWith("alice", 1000);
    });

    // L1: presence must not rebuild the rows on every tick of the 5s clock (ec9b75ac59)
    test("keeps the same set while nobody comes online or goes offline", async () => {
        const users = new OnlineUsers(async () => UserStatus.Online);
        await users.refresh(["alice"], 1000);
        const before = users.online;
        await users.refresh(["alice"], 6000);
        expect(users.online).toBe(before);
    });

    test("takes a new set when someone goes offline", async () => {
        let aliceOnline = true;
        const users = new OnlineUsers(async () =>
            aliceOnline ? UserStatus.Online : UserStatus.Offline,
        );
        await users.refresh(["alice"], 1000);
        aliceOnline = false;
        await users.refresh(["alice"], 6000);
        expect(users.online.size).toBe(0);
    });

    test("keeps only the latest look-up's answer", async () => {
        let answerFirst: (status: UserStatus) => void = () => {};
        const users = new OnlineUsers((_userId, now) =>
            now === 1000
                ? new Promise((resolve) => (answerFirst = resolve))
                : Promise.resolve(UserStatus.Offline),
        );
        const first = users.refresh(["alice"], 1000);
        await users.refresh(["alice"], 6000);
        answerFirst(UserStatus.Online);
        await first;
        expect(users.online.size).toBe(0);
    });

    test("a failed look-up counts the user as not online", async () => {
        const users = new OnlineUsers(async () => Promise.reject(new Error("offline")));
        await users.refresh(["alice"], 1000);
        expect(users.online.size).toBe(0);
    });
});
