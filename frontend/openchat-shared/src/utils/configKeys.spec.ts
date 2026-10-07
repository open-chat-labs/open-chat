// @vitest-environment node
import { readdirSync, readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { configKeys } from "./configKeys";

const frontendRoot = new URL("../../../", import.meta.url).pathname;
const sourceDirs = [
    "app/src",
    "component-lib/src",
    "openchat-agent/src",
    "openchat-client/src",
    "openchat-shared/src",
    "openchat-service-worker/src",
    "openchat-worker/src",
];

describe("configKeys", () => {
    /** Invariant: no two settings share a localStorage key. */
    it("gives every setting its own key", () => {
        const keys = Object.values(configKeys);
        expect(new Set(keys).size).toBe(keys.length);
    });

    /** Invariant: the last crypto sent is read from the key the client has written since the v2 change. */
    it("keeps lastCryptoSent on its v2 key", () => {
        expect(configKeys.lastCryptoSent).toBe("openchat_lastcryptosent_v2");
    });

    /** Invariant: configKeys is defined once, so copies can't drift apart. */
    it("is defined in exactly one file", () => {
        const definitions = sourceDirs.flatMap((dir) =>
            readdirSync(`${frontendRoot}${dir}`, { recursive: true })
                .map(String)
                .filter((path) => /\.(ts|js|svelte)$/.test(path))
                .map((path) => `${dir}/${path}`)
                .filter((path) =>
                    /\b(const|let|var)\s+configKeys\b/.test(
                        readFileSync(`${frontendRoot}${path}`, "utf8"),
                    ),
                ),
        );
        expect(definitions).toEqual(["openchat-shared/src/utils/configKeys.ts"]);
    });
});
