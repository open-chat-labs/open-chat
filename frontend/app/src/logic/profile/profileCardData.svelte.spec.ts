import type { OpenChat, PublicProfile, UserSummary } from "@client";
import { closeIfShowing, ProfileCardData } from "./profileCardData.svelte";

const profile = { username: "alice", bio: "", created: 0n } as PublicProfile;

function client(getUser: () => Promise<UserSummary | undefined>, found: PublicProfile | undefined) {
    return {
        getUser: vi.fn(getUser),
        getPublicProfile: vi.fn(() => ({
            subscribe: ({ onResult }: { onResult: (p: PublicProfile | undefined) => void }) =>
                onResult(found),
        })),
        logError: vi.fn(),
    } as never as OpenChat & { getPublicProfile: ReturnType<typeof vi.fn> };
}

async function settle() {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("a profile card's data", () => {
    // #10112 "Behaviours to keep": the card closes when the user or their public profile can't be loaded
    test("closes the card when the user or their public profile can't be loaded", async () => {
        const failedUser = vi.fn();
        new ProfileCardData(
            client(() => Promise.reject(new Error("offline")), profile),
            "u",
            failedUser,
        );
        const noProfile = vi.fn();
        new ProfileCardData(
            client(async () => ({}) as UserSummary, undefined),
            "u",
            noProfile,
        );
        await settle();
        expect(failedUser).toHaveBeenCalledOnce();
        expect(noProfile).toHaveBeenCalledOnce();
    });

    test("loads the profile it opened for, and stays open", async () => {
        const gone = vi.fn();
        const c = client(async () => ({ userId: "u" }) as UserSummary, profile);
        const card = new ProfileCardData(c, "u", gone);
        await card.loaded;
        expect(card.profile).toEqual(profile);
        expect(c.getPublicProfile).toHaveBeenCalledWith("u");
        expect(gone).not.toHaveBeenCalled();
    });
});

describe("a profile sheet's card for one person after another", () => {
    // a card whose public profile answers when the test says
    function slowClient() {
        let answer: (p: PublicProfile | undefined) => void = () => undefined;
        const c = {
            getUser: vi.fn(async () => ({ userId: "a" }) as UserSummary),
            getPublicProfile: vi.fn(() => ({
                subscribe: ({ onResult }: { onResult: (p: PublicProfile | undefined) => void }) =>
                    (answer = onResult),
            })),
            getLastOnlineDate: vi.fn(async () => undefined),
            logError: vi.fn(),
        } as never as OpenChat;
        return { c, answer: (p: PublicProfile | undefined) => answer(p) };
    }

    // A's profile was slow and isn't found, after the sheet has moved on to B: B's stays open
    test("an answer about someone shown before doesn't close it on someone else", async () => {
        let showing: string | undefined = "a";
        const close = vi.fn();
        const { c, answer } = slowClient();
        new ProfileCardData(
            c,
            "a",
            closeIfShowing("a", () => showing, close),
        );
        await settle();
        showing = "b";
        answer(undefined);
        expect(close).not.toHaveBeenCalled();
    });

    test("closes it when it's still showing them, and not once it's closed", () => {
        let showing: string | undefined = "a";
        const close = vi.fn();
        const gone = closeIfShowing("a", () => showing, close);
        gone();
        expect(close).toHaveBeenCalledOnce();
        showing = undefined;
        gone();
        expect(close).toHaveBeenCalledOnce();
    });
});
