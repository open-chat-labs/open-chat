import type { CommunityIdentifier } from "@client";
import { resolve } from "@src/utils/routeTable.testing";
import { locationFor, type StackStep, type TabsLocation } from "../router/locations";
import { mergeStack, TabStacks } from "./tabStacks.svelte";

const community = (communityId: string): CommunityIdentifier => ({
    kind: "community",
    communityId,
});

// The place a URL names, as the shell gets it
// `communityId` null: the user has no community
function at(url: string, communityId: string | null = "c1"): TabsLocation {
    const location = locationFor(resolve(url), url, {
        signedOut: false,
        community: communityId === null ? undefined : community(communityId),
    });
    if (location.area !== "tabs") throw new Error(`${url} isn't in the tabs`);
    return location;
}

const urls = (steps: StackStep[] | undefined) => steps?.map((s) => s.url);

// A stack that got where it is by these URLs, one after another
function walk(...path: string[]): StackStep[] {
    let steps: StackStep[] | undefined;
    for (const url of path) steps = mergeStack(steps, at(url).steps).steps;
    return steps ?? [];
}

describe("a tab's stack arriving somewhere", () => {
    test("starts as the URL's own stack", () => {
        const { steps, change } = mergeStack(undefined, at("/chats/user/u1").steps);
        expect(urls(steps)).toEqual(["/chats", "/chats/user/u1"]);
        expect(change).toBe("replace");
    });

    test("pushes going deeper", () => {
        const { steps, change } = mergeStack(walk("/chats"), at("/chats/group/g1").steps);
        expect(urls(steps)).toEqual(["/chats", "/chats/group/g1"]);
        expect(change).toBe("push");
        const thread = mergeStack(steps, at("/chats/group/g1/5?open=true").steps);
        expect(urls(thread.steps)).toEqual([
            "/chats",
            "/chats/group/g1",
            "/chats/group/g1/5?open=true",
        ]);
        expect(thread.change).toBe("push");
    });

    test("pops back to a screen it has", () => {
        const { steps, change } = mergeStack(
            walk("/chats", "/chats/group/g1", "/chats/group/g1/5?open=true"),
            at("/chats/group/g1").steps,
        );
        expect(urls(steps)).toEqual(["/chats", "/chats/group/g1"]);
        expect(change).toBe("pop");
        const root = mergeStack(steps, at("/chats").steps);
        expect(urls(root.steps)).toEqual(["/chats"]);
        expect(root.change).toBe("pop");
    });

    test("keeps the screen it's on when only the URL's details change", () => {
        const before = walk("/chats", "/chats/group/g1");
        const { steps, change } = mergeStack(before, at("/chats/group/g1/57").steps);
        expect(urls(steps)).toEqual(["/chats", "/chats/group/g1/57"]);
        expect(steps.map((s) => s.key)).toEqual(before.map((s) => s.key));
        expect(change).toBe("same");
    });

    test("replaces what's above the screen in common going sideways", () => {
        const { steps, change } = mergeStack(
            walk("/chats", "/chats/group/g1"),
            at("/chats/user/u1").steps,
        );
        expect(urls(steps)).toEqual(["/chats", "/chats/user/u1"]);
        expect(change).toBe("replace");
        // Done on a Send lands on the token's page, over the wallet
        const done = mergeStack(
            walk("/wallet", "/wallet/ledger1", "/wallet/send?token=ledger1"),
            at("/wallet/ledger2").steps,
        );
        expect(urls(done.steps)).toEqual(["/wallet", "/wallet/ledger2"]);
        expect(done.change).toBe("replace");
    });

    test("keeps the screens it went through under the one in common", () => {
        // the threads list a conversation was opened from stays under it
        const { steps } = mergeStack(
            walk("/community/c1", "/community/c1?threads", "/community/c1/channel/9?threads"),
            at("/community/c1/channel/9/3?open=true").steps,
        );
        expect(urls(steps)).toEqual([
            "/community/c1",
            "/community/c1?threads",
            "/community/c1/channel/9",
            "/community/c1/channel/9/3?open=true",
        ]);
    });

    test("starts again, as a replacement, when the tab's root changes", () => {
        // not a pop: the channel doesn't slide out as if Back was pressed
        const { steps, change } = mergeStack(
            walk("/community/c1", "/community/c1/channel/9"),
            at("/community/c2").steps,
        );
        expect(urls(steps)).toEqual(["/community/c2"]);
        expect(change).toBe("replace");
        const channel = mergeStack(
            walk("/community/c1", "/community/c1/channel/9"),
            at("/community/c2/channel/4").steps,
        );
        expect(urls(channel.steps)).toEqual(["/community/c2", "/community/c2/channel/4"]);
        expect(channel.change).toBe("replace");
        // Explore as the root, then a community: another root too
        const explore = mergeStack(at("/welcome", null).steps, at("/community/c1").steps);
        expect(urls(explore.steps)).toEqual(["/community/c1"]);
        expect(explore.change).toBe("replace");
        // Favourites in place of the Chats list
        const favourites = mergeStack(walk("/chats", "/chats/group/g1"), at("/favourite").steps);
        expect(favourites.change).toBe("replace");
    });

    test("pushes Explore over the community the tab shows", () => {
        const { steps, change } = mergeStack(walk("/community/c1"), at("/communities").steps);
        expect(urls(steps)).toEqual(["/community/c1", "/communities"]);
        expect(change).toBe("push");
    });
});

describe("the tabs' stacks", () => {
    test("show the tab the URL is on", () => {
        const stacks = new TabStacks();
        stacks.arrive(at("/wallet/ledger1"));
        expect(stacks.tab).toBe("wallet");
        expect(urls(stacks.steps)).toEqual(["/wallet", "/wallet/ledger1"]);
        expect(stacks.change).toBe("switch");
    });

    test("keep each tab's stack across tab switches", () => {
        const stacks = new TabStacks();
        stacks.arrive(at("/chats"));
        stacks.arrive(at("/chats/group/g1"));
        stacks.arrive(at("/wallet"));
        stacks.arrive(at("/wallet/ledger1"));
        // tapping Chats goes to where it was left
        expect(stacks.topUrl("chats")).toBe("/chats/group/g1");
        stacks.arrive(at(stacks.topUrl("chats") ?? ""));
        expect(stacks.tab).toBe("chats");
        expect(urls(stacks.steps)).toEqual(["/chats", "/chats/group/g1"]);
        expect(urls(stacks.stackOf("wallet"))).toEqual(["/wallet", "/wallet/ledger1"]);
    });

    test("say how the stack showing changed", () => {
        const stacks = new TabStacks();
        stacks.arrive(at("/chats"));
        stacks.arrive(at("/chats/group/g1"));
        expect(stacks.change).toBe("push");
        stacks.arrive(at("/chats"));
        expect(stacks.change).toBe("pop");
        stacks.arrive(at("/wallet"));
        expect(stacks.change).toBe("switch");
    });

    test("go back to the screen under the top, and nowhere from a root", () => {
        const stacks = new TabStacks();
        stacks.arrive(at("/chats"));
        expect(stacks.backUrl()).toBeUndefined();
        stacks.arrive(at("/chats/group/g1/57"));
        stacks.arrive(at("/chats/group/g1/57?open=true"));
        expect(stacks.backUrl()).toBe("/chats/group/g1");
    });

    test("know where a tab not opened yet is", () => {
        const stacks = new TabStacks();
        stacks.arrive(at("/chats"));
        expect(stacks.topUrl("you")).toBeUndefined();
        expect(stacks.root("you")).toBeUndefined();
        expect(stacks.root("chats")?.url).toBe("/chats");
    });

    test("keep the stack a URL was entered with when only the data under it changes", () => {
        // no communities yet: Explore is the root; joining one doesn't push Explore over it
        const stacks = new TabStacks();
        stacks.arrive(at("/welcome", null));
        const steps = stacks.steps;
        stacks.arrive(at("/welcome", "c1"));
        expect(stacks.steps).toBe(steps);
        expect(urls(stacks.steps)).toEqual(["/welcome"]);
        // the next URL takes the new data in
        stacks.arrive(at("/communities", "c1"));
        expect(urls(stacks.steps)).toEqual(["/community/c1", "/communities"]);
    });

    test("don't change for the same place again", () => {
        const stacks = new TabStacks();
        stacks.arrive(at("/chats/group/g1"));
        const steps = stacks.steps;
        stacks.arrive(at("/chats/group/g1"));
        expect(stacks.steps).toBe(steps);
    });
});

describe("a screen with no URL", () => {
    const kinds = (stacks: TabStacks) => stacks.steps.map((s) => s.screen.kind);

    test("is pushed over the screen showing, at its URL, and Back takes it off", () => {
        const stacks = new TabStacks();
        stacks.arrive(at("/chats"));
        stacks.push({ kind: "new_chat" });
        expect(kinds(stacks)).toEqual(["chats", "new_chat"]);
        expect(urls(stacks.steps)).toEqual(["/chats", "/chats"]);
        expect(stacks.change).toBe("push");
        expect(stacks.localTop).toBe(true);
        expect(stacks.popLocal()).toBe(true);
        expect(kinds(stacks)).toEqual(["chats"]);
        expect(stacks.change).toBe("pop");
        // a screen with a URL isn't popped locally
        expect(stacks.popLocal()).toBe(false);
    });

    test("stays while the URL does (its place worked out again)", () => {
        const stacks = new TabStacks();
        stacks.arrive(at("/chats"));
        stacks.push({ kind: "new_chat" });
        stacks.arrive(at("/chats"));
        expect(kinds(stacks)).toEqual(["chats", "new_chat"]);
    });

    test("gives way to where it goes: picking someone in New chat opens the chat in its place", () => {
        const stacks = new TabStacks();
        stacks.arrive(at("/chats"));
        stacks.push({ kind: "new_chat" });
        stacks.arrive(at("/chats/user/u1"));
        expect(kinds(stacks)).toEqual(["chats", "conversation"]);
        expect(stacks.change).toBe("replace");
    });

    test("is still there after another tab", () => {
        const stacks = new TabStacks();
        stacks.arrive(at("/chats"));
        stacks.push({ kind: "new_chat" });
        stacks.arrive(at("/wallet"));
        stacks.arrive(at(stacks.topUrl("chats") ?? ""));
        expect(stacks.tab).toBe("chats");
        expect(stacks.change).toBe("switch");
        expect(kinds(stacks)).toEqual(["chats", "new_chat"]);
    });

    // the conversation's Back after its details have been and gone goes back to the list (it was
    // reported to stay on the chat: a probe had tapped the header's last button, its menu)
    test("over a conversation (its details), leaves the conversation's Back as it was", () => {
        const stacks = new TabStacks();
        stacks.arrive(at("/chats"));
        stacks.arrive(at("/chats/user/u1"));
        stacks.push({ kind: "chat_details", chatId: { kind: "direct_chat", userId: "u1" } });
        expect(kinds(stacks)).toEqual(["chats", "conversation", "chat_details"]);
        expect(stacks.backUrl()).toBe("/chats/user/u1");
        expect(stacks.popLocal()).toBe(true);
        expect(stacks.localTop).toBe(false);
        expect(stacks.popLocal()).toBe(false);
        expect(stacks.backUrl()).toBe("/chats");
        stacks.arrive(at("/chats"));
        expect(kinds(stacks)).toEqual(["chats"]);
        expect(stacks.change).toBe("pop");
    });

    test("pushed again, is popped back to; the tab tapped again takes them all off", () => {
        const stacks = new TabStacks();
        stacks.arrive(at("/chats"));
        stacks.push({ kind: "new_chat" });
        stacks.push({ kind: "new_group" });
        stacks.push({ kind: "new_chat" });
        expect(kinds(stacks)).toEqual(["chats", "new_chat"]);
        stacks.push({ kind: "new_group" });
        expect(stacks.popLocals()).toBe(true);
        expect(kinds(stacks)).toEqual(["chats"]);
        expect(stacks.popLocals()).toBe(false);
    });
});

describe("a tab given its root before it's opened", () => {
    test("gets it without showing it", () => {
        const stacks = new TabStacks();
        stacks.arrive(at("/chats"));
        stacks.prime("wallet", at("/wallet").steps[0]);
        expect(stacks.tab).toBe("chats");
        expect(stacks.root("wallet")?.url).toBe("/wallet");
    });

    test("keeps the stack of a tab already opened", () => {
        const stacks = new TabStacks();
        stacks.arrive(at("/wallet"));
        stacks.arrive(at("/chats/user/u1"));
        stacks.prime("chats", at("/chats").steps[0]);
        expect(urls(stacks.stackOf("chats"))).toEqual(["/chats", "/chats/user/u1"]);
    });

    test("opens on the same root when it's then shown", () => {
        const stacks = new TabStacks();
        stacks.arrive(at("/chats"));
        const root = at("/wallet").steps[0];
        stacks.prime("wallet", root);
        stacks.arrive(at("/wallet"));
        expect(stacks.tab).toBe("wallet");
        expect(stacks.root("wallet")?.key).toBe(root.key);
        expect(urls(stacks.steps)).toEqual(["/wallet"]);
    });
});
