// @vitest-environment node
import { ESLint, type Linter } from "eslint";
import { readdirSync } from "fs";
import { describe, expect, it } from "vitest";

const frontendRoot = new URL("..", import.meta.url).pathname;

// prefer-const can't see `bind:` writes in markup, so it stays off for every component.
const offForAllComponents = ["prefer-const"];

// Components the config deliberately relaxes, and the rules it relaxes for them.
const relaxed: Record<string, string[]> = {
    "app/src/components/Router.svelte": [
        "local/no-pagejs-direct",
        "@typescript-eslint/no-explicit-any",
    ],
    "app/src/components_mobile/Router.svelte": [
        "local/no-pagejs-direct",
        "@typescript-eslint/no-explicit-any",
    ],
    "app/src/components_mobile/home/SlidingModals.svelte": [
        "local/no-pagejs-direct",
        "@typescript-eslint/no-explicit-any",
    ],
};

function activeRules(config: Linter.Config | undefined): Set<string> {
    const active = Object.entries(config?.rules ?? {}).filter(([, entry]) => {
        const severity = Array.isArray(entry) ? entry[0] : entry;
        return severity !== "off" && severity !== 0;
    });
    return new Set(active.map(([rule]) => rule));
}

const components = readdirSync(`${frontendRoot}app/src`, { recursive: true })
    .map(String)
    .filter((path) => path.endsWith(".svelte"))
    .map((path) => `app/src/${path}`);

/**
 * Invariant: `npm run lint` checks every Svelte component, with every rule that applies to .ts files.
 * Before this, the config matched only three Router components and silently skipped the rest.
 */
describe("eslint config covers Svelte components", () => {
    const eslint = new ESLint({ cwd: frontendRoot });

    it("finds the components", () => {
        expect(components.length).toBeGreaterThan(1000);
    });

    it("lints every component with every rule active for .ts files", async () => {
        const tsRules = activeRules(
            await eslint.calculateConfigForFile("app/src/utils/remoteData.ts"),
        );
        expect(tsRules.size).toBeGreaterThan(50);

        const gaps: string[] = [];
        for (const path of components) {
            if (await eslint.isPathIgnored(path)) {
                gaps.push(`${path}: ignored`);
                continue;
            }
            const rules = activeRules(await eslint.calculateConfigForFile(path));
            const allowedOff = [...offForAllComponents, ...(relaxed[path] ?? [])];
            for (const rule of tsRules) {
                if (!rules.has(rule) && !allowedOff.includes(rule)) {
                    gaps.push(`${path}: ${rule} off`);
                }
            }
        }
        expect(gaps).toEqual([]);
    });
});
