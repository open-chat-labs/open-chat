import type { UserSummary } from "@client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PeopleSearch } from "./peopleSearch.svelte";

const user = (userId: string) => ({ userId, username: userId }) as UserSummary;

describe("PeopleSearch", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    test("looks the text up once it stops changing", async () => {
        const search = vi.fn(async (term: string) => [user(term)]);
        const people = new PeopleSearch(search, 300);
        people.set("lu");
        people.set("luc");
        expect(people.results).toEqual({ kind: "searching", term: "luc" });
        await vi.advanceTimersByTimeAsync(300);
        expect(search).toHaveBeenCalledTimes(1);
        expect(search).toHaveBeenCalledWith("luc");
        expect(people.results).toEqual({ kind: "found", term: "luc", people: [user("luc")] });
    });

    test("keeps only the latest search's answer", async () => {
        let answer: (users: UserSummary[]) => void = () => {};
        const search = vi.fn(
            (term: string) =>
                new Promise<UserSummary[]>((resolve) => {
                    if (term === "a") answer = resolve;
                    else resolve([user(term)]);
                }),
        );
        const people = new PeopleSearch(search, 10);
        people.set("a");
        await vi.advanceTimersByTimeAsync(10);
        people.set("ab");
        await vi.advanceTimersByTimeAsync(10);
        answer([user("a")]);
        await Promise.resolve();
        expect(people.results).toEqual({ kind: "found", term: "ab", people: [user("ab")] });
    });

    test("the same term again keeps the search it has; an emptied text drops it", async () => {
        const search = vi.fn(async (term: string) => [user(term)]);
        const people = new PeopleSearch(search, 10);
        people.set("lu");
        await vi.advanceTimersByTimeAsync(5);
        people.set("lu");
        await vi.advanceTimersByTimeAsync(5);
        expect(search).toHaveBeenCalledTimes(1);
        people.set("");
        expect(people.results).toEqual({ kind: "idle" });
    });

    test("a search still waiting when it's disposed never lands", async () => {
        const search = vi.fn(async (term: string) => [user(term)]);
        const people = new PeopleSearch(search, 10);
        people.set("lu");
        people.dispose();
        await vi.advanceTimersByTimeAsync(10);
        expect(search).not.toHaveBeenCalled();
    });
});
