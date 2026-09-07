import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileFunction } from "node:vm";
import { AndroidWebAuthnErrorCode } from "tauri-plugin-oc-api";
import {
    createSourceFile,
    isFunctionDeclaration,
    ScriptKind,
    ScriptTarget,
    transpileModule,
} from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classifyAndroidWebAuthnSignInFailure } from "./androidWebAuthnError";

const filename = resolve(process.cwd(), "app/src/components_mobile/onboard/OnboardModal.svelte");
const source = readFileSync(filename, "utf8");
const script = source.match(/<script lang="ts">([\s\S]*?)<\/script>/u)?.[1];
expect(script, "the real onboarding component script must exist").toBeDefined();
const syntax = createSourceFile(filename, script!, ScriptTarget.ES2022, true, ScriptKind.TS);
const declarations = syntax.statements.filter(
    (statement) => isFunctionDeclaration(statement) && statement.name?.text === "signIn",
);
expect(declarations, "execute the unique production signIn declaration").toHaveLength(1);
const signInDeclaration = transpileModule(declarations[0].getText(syntax), {
    compilerOptions: { target: ScriptTarget.ES2022 },
}).outputText;

type Platform = "browser" | "android" | "ios";
type SignInState = { step: string; error: string | undefined };

function harness(platform: Platform) {
    const client = {
        isNativeAndroid: () => platform === "android",
        isNativeApp: () => platform !== "browser",
        signInWithAndroidWebAuthn: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
        signInWithWebAuthn: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };
    // Execute the real component function, not a copied routing implementation. Only
    // its two state bindings and platform authentication I/O are isolated; the Android
    // failure classifier is the actual production implementation. These are behavioral
    // handler tests, not a claim to exercise the credential provider or mounted UI.
    const construct = compileFunction(
        `let step = "choose-auth";
         let error;
         ${signInDeclaration}
         return { signIn, state: () => ({ step, error }) };`,
        ["client", "classifyAndroidWebAuthnSignInFailure", "console"],
    );
    const flow = construct(client, classifyAndroidWebAuthnSignInFailure, console) as {
        signIn: () => void;
        state: () => SignInState;
    };
    return {
        client,
        ...flow,
        async reject(error: unknown) {
            client.signInWithAndroidWebAuthn.mockRejectedValueOnce(error);
            client.signInWithWebAuthn.mockRejectedValueOnce(error);
            flow.signIn();
            await Promise.resolve();
            await Promise.resolve();
        },
    };
}

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("mobile onboarding sign-in behavior", () => {
    it.each(["browser", "android", "ios"] as const)(
        "%s invokes its actual platform authentication route",
        async (platform) => {
            const flow = harness(platform);
            flow.signIn();
            await Promise.resolve();
            expect(flow.client.signInWithWebAuthn).toHaveBeenCalledTimes(
                platform === "browser" ? 1 : 0,
            );
            expect(flow.client.signInWithAndroidWebAuthn).toHaveBeenCalledTimes(
                platform === "browser" ? 0 : 1,
            );
            expect(flow.state()).toEqual({ step: "choose-auth", error: undefined });
        },
    );

    it("leaves Android cancellation on sign-in without an error or account-linking offer", async () => {
        const flow = harness("android");
        await flow.reject({ code: AndroidWebAuthnErrorCode.CommonUserCancelled });
        expect(flow.state()).toEqual({ step: "choose-auth", error: undefined });
        expect(console.error).not.toHaveBeenCalled();
    });

    it("offers account linking for a genuine Android no-passkey response", async () => {
        const flow = harness("android");
        await flow.reject({ code: AndroidWebAuthnErrorCode.AuthNoPasskey });
        expect(flow.state()).toEqual({
            step: "one-time-password",
            error: AndroidWebAuthnErrorCode.AuthNoPasskey,
        });
        expect(console.error).not.toHaveBeenCalled();
    });

    it.each([
        AndroidWebAuthnErrorCode.AuthEmptyResponse,
        AndroidWebAuthnErrorCode.AuthDeviceNotSupported,
        AndroidWebAuthnErrorCode.AuthTransientError,
        AndroidWebAuthnErrorCode.AuthCredentialError,
        AndroidWebAuthnErrorCode.AuthFetchFailed,
        AndroidWebAuthnErrorCode.CommonSystemNotReady,
        AndroidWebAuthnErrorCode.CommonNoLockScreen,
        AndroidWebAuthnErrorCode.CommonSecurityDenied,
        AndroidWebAuthnErrorCode.CommonDomPasskeyError,
        AndroidWebAuthnErrorCode.CommonInterrupted,
    ])("keeps Android %s visible without offering account linking", async (code) => {
        const flow = harness("android");
        const failure = { code };
        await flow.reject(failure);
        expect(flow.state()).toEqual({ step: "choose-auth", error: code });
        expect(console.error).toHaveBeenCalledWith("Android passkey sign-in error: ", failure);
    });

    it.each([
        ["exception", new Error("unexpected provider failure")],
        ["untyped failure", "AUTH_FAILED"],
        ["unknown identifier", { code: "new-unrecognized-error" }],
        ["malformed authentication data", { code: AndroidWebAuthnErrorCode.JsonAuthDataError }],
        ["untyped no-passkey string", AndroidWebAuthnErrorCode.AuthNoPasskey],
        ["null response", null],
    ])("keeps Android %s visible as a generic error without relinking", async (_name, failure) => {
        const flow = harness("android");
        await flow.reject(failure);
        expect(flow.state()).toEqual({ step: "choose-auth", error: "default" });
        expect(console.error).toHaveBeenCalledWith("Android passkey sign-in error: ", failure);
    });

    it.each([
        ["ios", "native.auth.error"],
        ["browser", "default"],
    ] as const)("preserves the %s AUTH_FAILED error mapping", async (platform, error) => {
        const flow = harness(platform);
        await flow.reject("AUTH_FAILED");
        expect(flow.state()).toEqual({ step: "choose-auth", error });
        expect(console.error).toHaveBeenCalledWith("Auth error: ", "AUTH_FAILED");
    });

    it.each(["ios", "browser"] as const)(
        "preserves the existing %s account-linking route for other authentication failures",
        async (platform) => {
            const flow = harness(platform);
            await flow.reject({ code: AndroidWebAuthnErrorCode.AuthNoPasskey });
            expect(flow.state()).toEqual({ step: "one-time-password", error: undefined });
        },
    );
});
