import type { ResourceKey } from "@client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileFunction } from "node:vm";
import { flushSync } from "svelte";
import { createClassComponent } from "svelte/legacy";
import { addMessages, init, locale } from "svelte-i18n";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Translatable from "../components_mobile/Translatable.svelte";
import arabic from "../i18n/ar.json";
import english from "../i18n/en.json";
import { i18nKey } from "../i18n/i18n";
import { nativeAuthErrorKey } from "./nativeAuthErrorKey";

// Translation edit-mode styling is unrelated to auth display; the actual
// Translatable component, action, formatter and message catalogs remain real.
vi.mock("../theme/themes", async () => {
    const { readable } = await import("svelte/store");
    return { currentTheme: readable({ accent: "#22a7f2" }) };
});

const filename = resolve(process.cwd(), "app/src/components_mobile/onboard/OnboardModal.svelte");
const source = readFileSync(filename, "utf8");
const errorViews = Array.from(
    source.matchAll(/<ErrorMessage>\s*<Translatable resourceKey=\{([^\n]+)\} \/>/gu),
);
expect(errorViews, "exercise the unique production onboarding error display").toHaveLength(1);
const componentResourceKey = compileFunction(`return ${errorViews[0][1]};`, [
    "error",
    "i18nKey",
    "nativeAuthErrorKey",
]) as (error: string, key: typeof i18nKey, authKey: typeof nativeAuthErrorKey) => ResourceKey;

const codes = [
    "alreadyRegistered",
    "authEmptyResponse",
    "codeInvalid",
    "credentialError",
    "createPasskeyFail",
    "default",
    "deviceNotSupported",
    "domPasskeyError",
    "interrupted",
    "linkingCodeNotFound",
    "maxLinkedIdentitiesLimitReached",
    "noLockScreen",
    "noPasskey",
    "noProviders",
    "passkeyFetchFailed",
    "securityDenied",
    "systemNotReady",
    "transientSystemError",
] as const;

const cleanup: (() => void)[] = [];
function renderError(error: string) {
    // Evaluate the production resourceKey expression, then mount the exact
    // component it supplies. This catches incorrect namespaces even when the
    // handler-state and standalone mapper tests both pass.
    const resourceKey = componentResourceKey(error, i18nKey, nativeAuthErrorKey);
    const target = document.body.appendChild(document.createElement("div"));
    const component = createClassComponent({
        component: Translatable,
        target,
        props: { resourceKey },
    });
    cleanup.push(() => {
        component.$destroy();
        target.remove();
    });
    flushSync();
    return { resourceKey, text: target.textContent?.trim() };
}

beforeEach(async () => {
    addMessages("en", english);
    addMessages("ar", arabic);
    await init({ fallbackLocale: "en", initialLocale: "en" });
});

afterEach(() => {
    cleanup.splice(0).forEach((destroy) => destroy());
});

describe("mobile onboarding authentication error display", () => {
    it.each(codes)("renders the real English message for %s", (code) => {
        const messages: Record<string, string> = english.native.auth.errors;
        const expected = messages[code];
        expect(expected, `English must define ${code}`).toEqual(expect.any(String));
        expect(expected?.trim().length).toBeGreaterThan(0);
        const rendered = renderError(code);
        expect(rendered.resourceKey.key).toBe(`native.auth.errors.${code}`);
        expect(rendered.text).toBe(expected);
        expect(rendered.text).not.toBe(rendered.resourceKey.key);
    });

    it.each([
        "native.auth.error",
        "AUTH_FAILED",
        "new-provider-error",
        "native.auth.errors.nonexistent",
        "Unexpected private provider detail",
        "__proto__",
        "constructor",
        "",
    ])("renders the generic message for legacy or unknown error %j", (error) => {
        const rendered = renderError(error);
        expect(rendered.resourceKey.key).toBe("native.auth.errors.default");
        expect(rendered.text).toBe(english.native.auth.errors.default);
    });

    it.each(codes)("uses Arabic or the real English fallback for %s", async (code) => {
        await locale.set("ar");
        const arabicMessages: Record<string, string> = arabic.native.auth.errors;
        const englishMessages: Record<string, string> = english.native.auth.errors;
        const expected = arabicMessages[code] ?? englishMessages[code];
        expect(expected).toEqual(expect.any(String));
        const rendered = renderError(code);
        expect(rendered.text).toBe(expected);
        expect(rendered.text).not.toBe(rendered.resourceKey.key);
    });
});
