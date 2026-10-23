import type { OpenChat, PublicProfile, UserSummary } from "@client";
import { ProfileCardData } from "./profileCardData.svelte";

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
