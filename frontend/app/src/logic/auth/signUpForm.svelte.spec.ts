import { i18nKey, identityStateStore, type SignUpOutcome, type UserSummary } from "@client";
import { recoveryEmailValid, SignUpForm, type SignUpFormClient } from "./signUpForm.svelte";

const lucy = { userId: "r1", username: "lucy", kind: "user", suspended: false } as UserSummary;
const hamish = { userId: "r2", username: "hamish", kind: "user", suspended: false } as UserSummary;

function fakeClient(outcome: SignUpOutcome = { kind: "success" }) {
    return {
        checkUsername: vi.fn(async () => "success" as const),
        logError: vi.fn(),
        signUp: vi.fn(async () => outcome),
        getReferringUser: vi.fn(async (): Promise<UserSummary | undefined> => undefined),
        setReferralCode: vi.fn(),
        clearReferralCode: vi.fn(),
    };
}

function formFor(client: SignUpFormClient): SignUpForm {
    return new SignUpForm(client);
}

async function named(form: SignUpForm, username: string): Promise<void> {
    await form.username.checkNow(username);
}

beforeEach(() => {
    localStorage.clear();
    identityStateStore.set({ kind: "registering" });
});

describe("the recovery email", () => {
    test("is optional, and only an address when there is one", () => {
        expect(recoveryEmailValid("")).toBe(true);
        expect(recoveryEmailValid("  ")).toBe(true);
        expect(recoveryEmailValid("me@example.com")).toBe(true);
        expect(recoveryEmailValid("me@")).toBe(false);
    });
});

describe("the sign-up form", () => {
    test("isn't ready without a name that can be used, or with an email that isn't one", async () => {
        const form = formFor(fakeClient());
        expect(form.ready).toBe(false);
        await named(form, "newperson");
        expect(form.ready).toBe(true);
        form.email = "not-an-address";
        expect(form.ready).toBe(false);
        expect(await form.submit(true)).toBeUndefined();
    });

    test("isn't sent without the terms agreed to", async () => {
        const client = fakeClient();
        const form = formFor(client);
        await named(form, "newperson");
        expect(await form.submit(false)).toBeUndefined();
        expect(client.signUp).not.toHaveBeenCalled();
    });

    test("makes the account with the email trimmed, and a picked referrer's code", async () => {
        const client = fakeClient();
        const form = formFor(client);
        await named(form, "newperson");
        form.email = " me@example.com ";
        form.pickReferrer(lucy, "search");
        await expect(form.submit(true)).resolves.toEqual({ kind: "success" });
        expect(client.setReferralCode).toHaveBeenCalledWith("r1");
        expect(client.signUp).toHaveBeenCalledWith(
            "newperson",
            "me@example.com",
            true,
            undefined,
            undefined,
        );
    });

    test("makes the account with the photo picked", async () => {
        const client = fakeClient();
        const form = formFor(client);
        await named(form, "newperson");
        const avatar = { data: new Uint8Array([1]), url: "data:image/png;base64,AQ==" };
        form.avatar = avatar;
        await form.submit(true);
        expect(client.signUp).toHaveBeenCalledWith("newperson", undefined, true, undefined, avatar);
    });

    test("the link's referrer is the referrer, unless one was picked first", async () => {
        const client = fakeClient();
        client.getReferringUser.mockResolvedValue(lucy);
        const form = formFor(client);
        await form.loadLinkReferrer();
        expect(form.referrer).toEqual({ user: lucy, source: "link" });

        const picked = formFor(client);
        picked.pickReferrer(hamish, "pasted");
        await picked.loadLinkReferrer();
        expect(picked.referrer).toEqual({ user: hamish, source: "pasted" });
    });

    test("removing the link's referrer drops its code", async () => {
        const client = fakeClient();
        client.getReferringUser.mockResolvedValue(lucy);
        const form = formFor(client);
        await form.loadLinkReferrer();
        form.removeReferrer();
        await named(form, "newperson");
        await form.submit(true);
        expect(client.clearReferralCode).toHaveBeenCalled();
        expect(client.setReferralCode).not.toHaveBeenCalled();
    });

    test("a refused referral says why and drops the referrer, so the next try goes without it", async () => {
        const client = fakeClient({
            kind: "referral_refused",
            reason: i18nKey("register.referralCodeInvalid"),
        });
        const form = formFor(client);
        await named(form, "newperson");
        form.pickReferrer(lucy, "qr");
        await form.submit(true);
        expect(form.referralRefused).toBe(true);
        expect(form.error).toBe("register.referralCodeInvalid");
        expect(form.referrer).toBeUndefined();
        expect(form.busy).toBe(false);
    });

    test("starts from the name last tried until an account is made", async () => {
        const client = fakeClient({
            kind: "failed",
            reason: i18nKey("register.usernameTaken"),
        });
        const form = formFor(client);
        await named(form, "taken1");
        await form.submit(true);
        expect(form.error).toBe("register.usernameTaken");
        expect(formFor(client).username.value).toBe("taken1");

        client.signUp.mockResolvedValueOnce({ kind: "success" });
        await form.submit(true);
        expect(formFor(client).username.value).toBe("");
    });
});
