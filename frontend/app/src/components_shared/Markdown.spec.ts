import { allUsersStore, userGroupSummariesStore } from "@client";
import { marked } from "marked";
import { flushSync, mount, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DOMPurifyDefault } from "../utils/domPurify";
import Markdown from "./Markdown.svelte";

const client = {
    stripLinkDisabledMarker: (t: string) => t,
    toDatetimeString: (d: Date) => d.toISOString(),
    logError: () => {},
};

function user(userId: string, username: string) {
    return { kind: "user", userId, username, updated: 0n } as never;
}

function setUsers(...users: [string, string][]) {
    allUsersStore.set(new Map(users.map(([id, name]) => [id, user(id, name)])));
}

function mountMarkdown(text: string, target: HTMLElement) {
    return mount(Markdown, {
        target,
        props: { text },
        context: new Map([["client", client]]),
    });
}

describe("Markdown.svelte", () => {
    let target: HTMLElement;
    let subscribeSpy: ReturnType<typeof vi.spyOn>;
    let groupSubscribeSpy: ReturnType<typeof vi.spyOn>;
    const mounted: object[] = [];

    beforeEach(() => {
        target = document.createElement("div");
        document.body.appendChild(target);
        setUsers(["u-1", "alice"], ["u-2", "bob"]);
        subscribeSpy = vi.spyOn(allUsersStore, "subscribe");
        groupSubscribeSpy = vi.spyOn(userGroupSummariesStore, "subscribe");
    });

    afterEach(() => {
        for (const m of mounted) unmount(m);
        mounted.length = 0;
        target.remove();
        vi.restoreAllMocks();
    });

    test("renders a mention as a profile-link", () => {
        mounted.push(mountMarkdown("hi @UserId(u-1)", target));
        flushSync();
        expect(target.innerHTML).toContain(
            `<profile-link text="alice" user-id="u-1" suppress-links="false">`,
        );
    });

    test("only mention-bearing instances subscribe to the user stores", () => {
        for (let i = 0; i < 100; i++) {
            const text = i < 10 ? `hello @UserId(u-1) #${i}` : `hello #${i}`;
            mounted.push(mountMarkdown(text, target));
        }
        flushSync();
        expect(subscribeSpy).toHaveBeenCalledTimes(10);
        expect(groupSubscribeSpy).toHaveBeenCalledTimes(0);
    });

    test("a store publish with unchanged names does not re-parse or re-sanitise", () => {
        mounted.push(mountMarkdown("hi @UserId(u-1)", target));
        flushSync();
        const parse = vi.spyOn(marked, "parseInline");
        const sanitize = vi.spyOn(DOMPurifyDefault, "sanitize");

        // republish an equal-by-value but different Map (what the 60s poll does)
        setUsers(["u-1", "alice"], ["u-2", "bob"], ["u-3", "carol"]);
        flushSync();
        expect(parse).toHaveBeenCalledTimes(0);
        expect(sanitize).toHaveBeenCalledTimes(0);
        expect(target.innerHTML).toContain(`text="alice"`);
    });

    test("a store publish that changes a mentioned name re-renders", () => {
        mounted.push(mountMarkdown("hi @UserId(u-1)", target));
        flushSync();
        const parse = vi.spyOn(marked, "parseInline");
        const sanitize = vi.spyOn(DOMPurifyDefault, "sanitize");
        setUsers(["u-1", "alicia"], ["u-2", "bob"]);
        flushSync();
        expect(parse).toHaveBeenCalledTimes(1);
        expect(sanitize).toHaveBeenCalledTimes(1);
        expect(target.innerHTML).toContain(`text="alicia"`);
    });
});
