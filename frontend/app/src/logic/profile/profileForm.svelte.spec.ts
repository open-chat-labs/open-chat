import type { PublicProfile, SaveProfileOutcome } from "@client";
import { i18nKey } from "@src/i18n/i18n";
import { ProfileForm } from "./profileForm.svelte";

const saved: PublicProfile = {
    username: "julian",
    displayName: "Julian",
    bio: "old bio",
    isPremium: false,
    phoneIsVerified: false,
    created: 0n,
};

function setup(save?: (original: PublicProfile, candidate: PublicProfile) => SaveProfileOutcome) {
    let profile = $state(saved);
    let readOnly = $state(false);
    const client = {
        checkUsername: vi.fn(async () => "success" as const),
        logError: vi.fn(),
        // as the client does: each saved field is written to the user's profile
        saveProfile: vi.fn(async (original: PublicProfile, candidate: PublicProfile) => {
            const outcome = save?.(original, candidate) ?? { profile: candidate, errors: {} };
            profile = outcome.profile;
            return outcome;
        }),
    };
    const form = new ProfileForm(
        client,
        () => profile,
        () => readOnly,
    );
    return {
        form,
        client,
        load: (p: PublicProfile) => (profile = p),
        setReadOnly: (r: boolean) => (readOnly = r),
    };
}

describe("the profile form", () => {
    test("follows the saved profile until a field is edited", () => {
        const { form, load } = setup();
        form.bio = "my bio";
        load({ ...saved, displayName: "Jules", bio: "loaded bio" });
        expect(form.displayName).toBe("Jules");
        expect(form.bio).toBe("my bio");
    });

    test("can be saved once something changed and every field is valid", () => {
        const { form } = setup();
        expect(form.canSave).toBe(false);
        form.bio = "new bio";
        expect(form.canSave).toBe(true);
        form.displayName = "x";
        expect(form.displayNameValid).toBe(false);
        expect(form.canSave).toBe(false);
    });

    test("an empty display name is none", () => {
        const { form } = setup();
        form.displayName = "";
        expect(form.displayName).toBeUndefined();
        expect(form.displayNameValid).toBe(true);
        expect(form.changes.displayName).toBe(true);
    });

    test("can't be saved while suspended or a guest", () => {
        const { form, setReadOnly } = setup();
        form.bio = "new bio";
        setReadOnly(true);
        expect(form.canSave).toBe(false);
    });

    test("waits for the username check", async () => {
        vi.useFakeTimers();
        const { form } = setup();
        form.username.set("julian2");
        expect(form.canSave).toBe(false);
        await vi.runAllTimersAsync();
        expect(form.canSave).toBe(true);
        vi.useRealTimers();
    });

    test("saves only the changes, then follows the saved profile again", async () => {
        const { form, client } = setup();
        form.bio = "new bio";
        expect(await form.save()).toEqual({ kind: "saved" });
        expect(client.saveProfile).toHaveBeenCalledWith(saved, { ...saved, bio: "new bio" });
        expect(form.changes).toEqual({ username: false, displayName: false, bio: false });
        expect(form.canSave).toBe(false);
    });

    test("a rejected field keeps its unsaved value and its reason", async () => {
        const { form } = setup((original, candidate) => ({
            profile: { ...original, bio: candidate.bio },
            errors: { displayName: "register.displayNameInvalid" },
        }));
        form.displayName = "Jules";
        form.bio = "new bio";
        expect(await form.save()).toEqual({ kind: "rejected" });
        expect(form.displayName).toBe("Jules");
        expect(form.errors).toEqual({ displayName: "register.displayNameInvalid" });
        expect(form.changes.bio).toBe(false);
    });

    test("a rejected username's reason shows until the name is changed", async () => {
        vi.useFakeTimers();
        const { form } = setup((original) => ({
            profile: original,
            errors: { username: "register.usernameTaken" },
        }));
        form.username.set("julian2");
        await vi.runAllTimersAsync();
        await form.save();
        expect(form.usernameError).toBe("register.usernameTaken");
        form.username.set("julian3");
        expect(form.usernameError).toBeUndefined();
        vi.useRealTimers();
    });

    test("a failure the user can't fix is reported", async () => {
        const reason = i18nKey("unableToSaveUserProfile");
        const { form } = setup((original) => ({ profile: original, errors: {}, failure: reason }));
        form.bio = "new bio";
        expect(await form.save()).toEqual({ kind: "failed", reason });
        expect(form.bio).toBe("new bio");
    });
});
