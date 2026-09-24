import type { UserSummary } from "@shared";
import { allUsersStore, suspendedUsersStore } from "./stores";
import { UsersState, userStore } from "./state";

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

describe("migrated users", () => {
    let users: UsersState;

    beforeEach(() => {
        allUsersStore.set(new Map());
        suspendedUsersStore.set(new Set());
        users = new UsersState();
    });

    test("a migrated user can be looked up by their earlier id", () => {
        users.addMigratedUserIds(new Map([["old", "new"]]));
        users.addMany([user("new")]);

        expect(users.get("old")?.userId).toBe("new");
        expect(users.get("new")?.userId).toBe("new");
        expect(users.latestUserId("old")).toBe("new");
    });

    test("an entry under the earlier id is replaced once the mapping is known", () => {
        users.addMany([user("old"), user("new")]);
        users.addMigratedUserIds(new Map([["old", "new"]]));

        expect(users.get("old")?.userId).toBe("new");
    });

    test("updates to the user reach the entry under their earlier id", () => {
        users.addMigratedUserIds(new Map([["old", "new"]]));
        users.addMany([user("new")]);

        users.addUser({ ...user("new"), username: "renamed" });
        users.userSuspended("old", true);

        expect(users.get("old")?.username).toBe("renamed");
        expect(users.get("old")?.suspended).toBe(true);
        expect(users.get("new")?.suspended).toBe(true);
    });

    test("a user migrated again is found by each of their earlier ids", () => {
        users.addMigratedUserIds(new Map([["oldest", "old"]]));
        users.addMigratedUserIds(new Map([["old", "new"]]));
        users.addMany([user("new")]);

        expect(users.get("oldest")?.userId).toBe("new");
        expect(users.get("old")?.userId).toBe("new");
        expect(users.latestUserId("oldest")).toBe("new");
    });

    test("a mapping already known does not publish", () => {
        users.addMigratedUserIds(new Map([["old", "new"]]));
        users.addMany([user("new")]);
        let publishes = 0;
        const unsub = allUsersStore.subscribe(() => publishes++);
        publishes = 0;

        users.addMigratedUserIds(new Map([["old", "new"]]));

        unsub();
        expect(publishes).toBe(0);
    });
});
