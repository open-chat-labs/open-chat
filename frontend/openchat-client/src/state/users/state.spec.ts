import type { UserSummary } from "@shared";
import { allUsersStore, suspendedUsersStore } from "./stores";
import { userStore } from "./state";

function user(userId: string, suspended = false): UserSummary {
    return {
        kind: "user",
        userId,
        username: userId,
        displayName: undefined,
        updated: BigInt(0),
        suspended,
        diamondStatus: "inactive",
        chitBalance: 0,
        totalChitEarned: 0,
        streak: 0,
        maxStreak: 0,
        isUniquePerson: false,
    };
}

describe("user store no-op publishes", () => {
    let publishes = 0;
    let suspendedPublishes = 0;
    let unsubs: (() => void)[] = [];

    beforeEach(() => {
        allUsersStore.set(new Map());
        suspendedUsersStore.set(new Set());
        userStore.addMany([user("a"), user("b")]);
        unsubs = [
            allUsersStore.subscribe(() => publishes++),
            suspendedUsersStore.subscribe(() => suspendedPublishes++),
        ];
        publishes = 0;
        suspendedPublishes = 0;
    });

    afterEach(() => unsubs.forEach((u) => u()));

    describe("setUpdated", () => {
        test("real update publishes once", () => {
            userStore.setUpdated(["a", "b"], BigInt(5));
            expect(publishes).toBe(1);
            expect(userStore.get("a")?.updated).toBe(BigInt(5));
            expect(userStore.get("b")?.updated).toBe(BigInt(5));
        });

        test("empty list does not publish", () => {
            userStore.setUpdated([], BigInt(5));
            expect(publishes).toBe(0);
        });

        test("unknown users do not publish", () => {
            userStore.setUpdated(["x", "y"], BigInt(5));
            expect(publishes).toBe(0);
        });

        test("already at that timestamp does not publish", () => {
            userStore.setUpdated(["a"], BigInt(5));
            publishes = 0;
            userStore.setUpdated(["a"], BigInt(5));
            expect(publishes).toBe(0);
        });

        test("mix of known and unknown users publishes once", () => {
            userStore.setUpdated(["x", "a"], BigInt(5));
            expect(publishes).toBe(1);
            expect(userStore.get("a")?.updated).toBe(BigInt(5));
        });
    });

    describe("userSuspended", () => {
        test("real change publishes both stores", () => {
            userStore.userSuspended("a", true);
            expect(publishes).toBe(1);
            expect(suspendedPublishes).toBe(1);
            expect(userStore.get("a")?.suspended).toBe(true);
            expect(userStore.suspendedUsers.has("a")).toBe(true);
        });

        test("unknown user does not publish", () => {
            userStore.userSuspended("x", true);
            expect(publishes).toBe(0);
            expect(suspendedPublishes).toBe(0);
        });

        test("already in that state does not publish", () => {
            userStore.userSuspended("a", true);
            publishes = 0;
            suspendedPublishes = 0;
            userStore.userSuspended("a", true);
            expect(publishes).toBe(0);
            expect(suspendedPublishes).toBe(0);
        });
    });

    describe("addMany", () => {
        test("empty list does not publish", () => {
            userStore.addMany([]);
            expect(publishes).toBe(0);
        });
    });
});
