import { identityStateStore, type IdentityState, type OpenChat } from "@client";
import { configKeys } from "@shared";
import { flushSync, mount, unmount } from "svelte";
import AuthScreen from "./AuthScreen.svelte";

describe("the in-app sign-in", () => {
    let target: HTMLElement;
    let app: object;
    const client = {
        updateIdentityState: vi.fn((state: IdentityState) => identityStateStore.set(state)),
        logout: vi.fn(),
        getReferringUser: vi.fn(async () => undefined as unknown),
    };

    beforeEach(() => {
        identityStateStore.set({ kind: "anon" });
        localStorage.setItem(configKeys.selectedAuthEmail, "me@example.com");
        client.getReferringUser.mockResolvedValueOnce({
            userId: "r1",
            username: "hamish",
            displayName: "Hamish",
        });
        target = document.body.appendChild(document.createElement("div"));
        app = mount(AuthScreen, {
            target,
            context: new Map([["client", client as unknown as OpenChat]]),
        });
        flushSync();
    });
    afterEach(() => {
        unmount(app);
        target.remove();
        vi.clearAllMocks();
        identityStateStore.set({ kind: "anon" });
    });

    const set = (state: IdentityState) => {
        identityStateStore.set(state);
        flushSync();
    };
    const title = () => document.querySelector("#oc-auth-title")?.textContent;
    const close = () => {
        document
            .querySelector<HTMLButtonElement>('[role=dialog] .head-button[aria-label="Close"]')!
            .click();
        flushSync();
    };

    test("opens when the client asks for a sign-in, and closes once there's a user", () => {
        expect(title()).toBeUndefined();
        set({ kind: "logging_in" });
        expect(title()).toBe("Sign in to OpenChat");
        set({ kind: "loading_user", registering: false });
        expect(title()).toBe("Sign in to OpenChat");
        set({ kind: "logged_in" });
        expect(title()).toBeUndefined();
    });

    test("turns into sign-up for an identity without an account", () => {
        set({ kind: "logging_in" });
        set({ kind: "registering" });
        expect(title()).toBe("Create your account");
    });

    test("prefills the last email for sign-in, and the referral link's referrer for sign-up", async () => {
        set({ kind: "logging_in" });
        expect(document.querySelector<HTMLInputElement>("form.email input")!.value).toBe(
            "me@example.com",
        );
        set({ kind: "registering" });
        await vi.waitFor(() =>
            expect(document.querySelector(".field.picked .who")?.textContent).toContain("Hamish"),
        );
    });

    test("closing a sign-in goes back to anonymous", () => {
        set({ kind: "logging_in" });
        close();
        expect(client.updateIdentityState).toHaveBeenCalledWith({ kind: "anon" });
        expect(title()).toBeUndefined();
    });

    test("closing sign-up signs the account-less identity out", () => {
        set({ kind: "registering" });
        close();
        expect(client.logout).toHaveBeenCalled();
        expect(title()).toBeUndefined();
    });
});
