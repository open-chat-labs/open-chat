import type { CheckUsernameResponse } from "@client";
import { UsernameCheck } from "./usernameCheck.svelte";

function client(answer: (name: string) => Promise<CheckUsernameResponse>) {
    return { checkUsername: vi.fn(answer), logError: vi.fn() };
}

describe("a username being typed", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    test("starts as the original, valid when there is one", () => {
        expect(
            new UsernameCheck(
                client(async () => "success"),
                () => "julian",
            ).valid,
        ).toBe(true);
        expect(
            new UsernameCheck(
                client(async () => "success"),
                () => "",
            ).valid,
        ).toBe(false);
    });

    test("is checked once typing pauses, and is valid once the backend says it's free", async () => {
        const c = client(async () => "success");
        const check = new UsernameCheck(c, () => "julian");
        check.set("julian2");
        expect(check.status).toBe("checking");
        expect(check.valid).toBe(false);
        await vi.runAllTimersAsync();
        expect(c.checkUsername).toHaveBeenCalledWith("julian2", false);
        expect(check.status).toBe("available");
        expect(check.valid).toBe(true);
    });

    test("only the latest check counts", async () => {
        const c = client(async (name) => (name === "julian2" ? "success" : "username_taken"));
        const check = new UsernameCheck(c, () => "julian");
        check.set("julian1");
        check.set("julian2");
        await vi.runAllTimersAsync();
        expect(c.checkUsername).toHaveBeenCalledTimes(1);
        expect(check.status).toBe("available");
    });

    test("an answer that comes back after the name changed again is dropped", async () => {
        const answers: ((resp: CheckUsernameResponse) => void)[] = [];
        const c = client(() => new Promise((resolve) => answers.push(resolve)));
        const check = new UsernameCheck(c, () => "julian");
        check.set("julian1");
        await vi.runAllTimersAsync();
        check.set("julian2");
        answers[0]("success");
        await vi.runAllTimersAsync();
        expect(check.status).toBe("checking");
        answers[1]("username_taken");
        await vi.runAllTimersAsync();
        expect(check.status).toBe("taken");
    });

    test("a name that's taken says so", async () => {
        const check = new UsernameCheck(
            client(async () => "username_taken"),
            () => "julian",
        );
        check.set("someone");
        await vi.runAllTimersAsync();
        expect(check.valid).toBe(false);
        expect(check.error).toBe("register.usernameTaken");
    });

    test("a name that isn't one isn't sent", () => {
        const c = client(async () => "success");
        const check = new UsernameCheck(c, () => "julian");
        check.set("ab");
        expect(check.status).toBe("invalid");
        expect(c.checkUsername).not.toHaveBeenCalled();
    });

    test("the original in another case is allowed, even one shorter than the rules now ask", async () => {
        // the backend says it's taken: by this user
        const check = new UsernameCheck(
            client(async () => "username_taken"),
            () => "abc",
        );
        check.set("ABC");
        await vi.runAllTimersAsync();
        expect(check.valid).toBe(true);
    });

    test("a check that fails says so", async () => {
        const c = client(async () => Promise.reject(new Error("offline")));
        const check = new UsernameCheck(c, () => "julian");
        check.set("julian2");
        await vi.runAllTimersAsync();
        expect(check.error).toBe("register.errorCheckingUsername");
        expect(c.logError).toHaveBeenCalled();
    });

    test("typed back to the original, it isn't checked", () => {
        const c = client(async () => "success");
        const check = new UsernameCheck(c, () => "julian");
        check.set("julian2");
        check.set("julian");
        expect(check.status).toBe("unchanged");
        vi.runAllTimers();
        expect(c.checkUsername).not.toHaveBeenCalled();
    });
});
