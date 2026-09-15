import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";

// vitest resolves with the "browser" condition, which maps the bare "url" import in
// rollup.extras.mjs to a polyfill without fileURLToPath.
vi.mock("url", () => import("node:url"));

import { generateCspForScripts } from "../../rollup.extras.mjs";

// The website's Permissions-Policy header lives in .ic-assets.json5 (served by the asset
// canister); the rest of the CSP is built by rollup.extras.mjs. Issue #9338.

function permissionsPolicy(): Map<string, string> {
    const file = readFileSync(join(__dirname, "../../.ic-assets.json5"), "utf8");
    const match = file.match(/"Permissions-Policy":\s*"((?:[^"\\]|\\.)*)"/);
    if (match === null) throw new Error("Permissions-Policy header not found");
    const value = match[1].replace(/\\"/g, '"');
    return new Map(
        value.split(",").map((entry) => {
            const [feature, allowlist] = entry.trim().split("=");
            return [feature, allowlist];
        }),
    );
}

function directive(csp: string, name: string): string {
    const found = csp
        .split(";")
        .map((d) => d.trim())
        .find((d) => d.startsWith(`${name} `) || d === name);
    if (found === undefined) throw new Error(`${name} directive not found`);
    return found.slice(name.length).trim();
}

describe("Permissions-Policy header", () => {
    const policy = permissionsPolicy();

    // Invariant: no Permissions-Policy feature is granted to every origin.
    test("no feature uses a wildcard allowlist", () => {
        for (const [feature, allowlist] of policy) {
            expect(allowlist, feature).not.toBe("*");
            expect(allowlist, feature).not.toContain("*");
        }
    });

    // Invariant: features with a third-party consumer name that origin and nothing else.
    test("Daily video calls keep camera, microphone, screen share and autoplay", () => {
        const daily = '"https://openchat.daily.co"';
        expect(policy.get("camera")).toBe(`(self ${daily})`);
        expect(policy.get("microphone")).toBe(`(self ${daily})`);
        expect(policy.get("display-capture")).toBe(`(${daily})`);
        expect(policy.get("autoplay")).toBe(`(self ${daily})`);
    });

    // Invariant: features the app calls on its own document stay enabled for self.
    test("self-only features stay on for the app", () => {
        expect(policy.get("web-share")).toBe("(self)");
        expect(policy.get("clipboard-write")).toBe("(self)");
        expect(policy.get("publickey-credentials-get")).toBe("(self)");
        expect(policy.get("fullscreen")).toMatch(/^\(self\b/);
        expect(policy.get("picture-in-picture")).toMatch(/^\(self\b/);
    });

    // Invariant: features with no consumer are off.
    test("unused features are disabled", () => {
        for (const feature of ["clipboard-read", "encrypted-media", "idle-detection"]) {
            expect(policy.get(feature), feature).toBe("()");
        }
    });
});

describe("CSP frame-src", () => {
    // Invariant: frames are limited to https in every build flavour, so javascript:, data:,
    // blob: and http frames are refused.
    test.each([
        ["production", false],
        ["development", true],
    ])("is https-only in %s builds", (_, development) => {
        const csp = generateCspForScripts(["window.x = 1;"], development);
        expect(directive(csp, "frame-src")).toBe("https:");
    });
});
