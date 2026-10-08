// @vitest-environment node
import { ESLint } from "eslint";
import { describe, expect, it, vi } from "vitest";

// Creating the first ESLint instance loads every plugin, which can take longer than the default 5s.
vi.setConfig({ testTimeout: 30_000 });

const frontendRoot = new URL("..", import.meta.url).pathname;
const eslint = new ESLint({ cwd: frontendRoot });

const importRules = new Set([
    "no-restricted-imports",
    "local/no-restricted-dynamic-imports",
    "@typescript-eslint/no-restricted-imports",
    "no-restricted-syntax",
]);

async function importErrors(code: string, filePath: string): Promise<string[]> {
    const [result] = await eslint.lintText(code, { filePath });
    return result.messages.filter((m) => importRules.has(m.ruleId ?? "")).map((m) => m.ruleId!);
}

// Smoke tests that the import rules are switched on. Lint over the real code is what enforces them;
// these only catch the rules being dropped or narrowed by mistake, so a few representative cases are enough.

/** Invariant: app code never imports the agent or worker, statically or dynamically. */
describe("app never imports the agent or worker", () => {
    it("rejects an alias import, a relative path and a dynamic import", async () => {
        const file = "app/src/stores/example.ts";
        expect(
            await importErrors('import { x } from "@agent/services/openchatAgent";', file),
        ).toEqual(["no-restricted-imports"]);
        expect(
            await importErrors('import { x } from "../../../openchat-worker/src/worker";', file),
        ).toEqual(["no-restricted-imports"]);
        expect(await importErrors('export const x = import("@worker");', file)).toEqual([
            "local/no-restricted-dynamic-imports",
        ]);
    });

    it("rejects them in components and test files too", async () => {
        const component = '<script lang="ts">\n    import { x } from "@agent";\n</script>\n';
        expect(
            await importErrors(component, "app/src/components_mobile/home/Example.svelte"),
        ).toEqual(["no-restricted-imports"]);
        expect(
            await importErrors('import { x } from "@agent";', "app/src/utils/example.spec.ts"),
        ).toEqual(["no-restricted-imports"]);
    });
});

/** Invariant: app code imports the client only through `@client`; tests may reach inside it. */
describe("app imports the client only through @client", () => {
    it("rejects a path inside the client", async () => {
        expect(
            await importErrors(
                'import { x } from "@client/utils/time";',
                "app/src/i18n/example.ts",
            ),
        ).toEqual(["no-restricted-imports"]);
    });

    it("accepts the entry point, shared, and test files reaching inside the client", async () => {
        expect(
            await importErrors(
                'import { x } from "@client";\nimport { y } from "@shared";',
                "app/src/stores/example.ts",
            ),
        ).toEqual([]);
        expect(
            await importErrors(
                'import { x } from "@client/state/community/server";',
                "app/src/utils/example.spec.ts",
            ),
        ).toEqual([]);
    });
});

/** Invariant: new code doesn't import svelte/store values; type-only imports are fine. */
describe("svelte/store", () => {
    it("rejects value imports, static and dynamic, outside the allowlist", async () => {
        const file = "openchat-client/src/state/example.ts";
        expect(await importErrors('import { writable } from "svelte/store";', file)).toEqual([
            "@typescript-eslint/no-restricted-imports",
        ]);
        expect(await importErrors('export const s = import("svelte/store");', file)).toEqual([
            "no-restricted-syntax",
        ]);
    });

    it("accepts a type-only import", async () => {
        expect(
            await importErrors(
                'import type { Readable } from "svelte/store";',
                "app/src/utils/example.ts",
            ),
        ).toEqual([]);
    });
});
