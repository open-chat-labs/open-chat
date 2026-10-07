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

function component(script: string): string {
    return `<script lang="ts">\n${script}\n</script>\n`;
}

// App code outside the utils/ and components/ folders, so a narrowed `files` glob fails the spec.
const appFiles = [
    "app/src/utils/example.ts",
    "app/src/stores/example.ts",
    "app/src/i18n/example.ts",
    "app/src/utils/example.js",
    "app/src/stores/example.svelte.ts",
];
const appComponents = [
    "app/src/components/Example.svelte",
    "app/src/components_mobile/home/Example.svelte",
    "app/src/components_shared/Example.svelte",
];

const agentOrWorker = [
    "@agent",
    "@agent/services/openchatAgent",
    "@worker",
    "@worker/worker",
    "@worker?worker",
    "../../../openchat-agent/src/services/openchatAgent",
    "../../../openchat-worker/src/worker",
];
const insideClient = [
    "@client/state/localStorageStore",
    "@client/utils/time",
    "../../../openchat-client/src/utils/time",
];

/** Invariant 1: app code never imports the agent or worker, statically or dynamically. */
describe("app never imports the agent or worker", () => {
    it.each(agentOrWorker.flatMap((m) => appFiles.map((f) => [m, f])))(
        "rejects %s in %s",
        async (module, file) => {
            expect(await importErrors(`import { x } from "${module}";`, file)).toEqual([
                "no-restricted-imports",
            ]);
            expect(await importErrors(`export const x = import("${module}");`, file)).toEqual([
                "local/no-restricted-dynamic-imports",
            ]);
            expect(await importErrors(`export const x = import(\`${module}\`);`, file)).toEqual([
                "local/no-restricted-dynamic-imports",
            ]);
        },
    );

    it.each(agentOrWorker.flatMap((m) => appComponents.map((f) => [m, f])))(
        "rejects %s in %s",
        async (module, file) => {
            const code = component(
                `    import { x } from "${module}";\n    const y = import("${module}");`,
            );
            expect(await importErrors(code, file)).toEqual([
                "no-restricted-imports",
                "local/no-restricted-dynamic-imports",
            ]);
        },
    );

    it.each(agentOrWorker)("rejects %s in a test file", async (module) => {
        for (const file of ["app/src/utils/example.spec.ts", "app/src/utils/example.test.ts"]) {
            expect(await importErrors(`import { x } from "${module}";`, file)).toEqual([
                "no-restricted-imports",
            ]);
        }
    });
});

/** Invariant 2: app code imports the client only through `@client`; tests may reach inside it. */
describe("app imports the client only through @client", () => {
    it.each(insideClient.flatMap((m) => [...appFiles, ...appComponents].map((f) => [m, f])))(
        "rejects %s in %s",
        async (module, file) => {
            const script = `import { x } from "${module}";\nexport const y = import("${module}");`;
            const code = file.endsWith(".svelte") ? component(script) : script;
            expect(await importErrors(code, file)).toEqual([
                "no-restricted-imports",
                "local/no-restricted-dynamic-imports",
            ]);
        },
    );

    it("accepts the client's entry point and shared", async () => {
        const code =
            'import { x } from "@client";\nimport { y } from "@shared";\nexport const z = import("@client");';
        expect(await importErrors(code, "app/src/stores/example.ts")).toEqual([]);
    });

    it.each(["app/src/utils/example.spec.ts", "app/src/stores/example.test.ts"])(
        "lets %s reach inside the client",
        async (file) => {
            expect(
                await importErrors('import { x } from "@client/state/community/server";', file),
            ).toEqual([]);
        },
    );
});

/** Invariant 3: no new code imports svelte/store values; existing users are on a fixed allowlist. */
describe("svelte/store", () => {
    // New files next to allowlisted ones, so widening the allowlist to a folder fails the spec.
    it.each([
        "app/src/utils/example.ts",
        "app/src/stores/example.ts",
        "app/src/i18n/example.ts",
        "app/src/utils/example.spec.ts",
        "app/src/actions/example.ts",
        "openchat-client/src/stores/example.ts",
        "openchat-client/src/state/example.ts",
        "openchat-shared/src/utils/example.ts",
    ])("rejects value imports in %s", async (file) => {
        expect(await importErrors('import { writable } from "svelte/store";', file)).toEqual([
            "@typescript-eslint/no-restricted-imports",
        ]);
        expect(await importErrors('export const s = import("svelte/store");', file)).toEqual([
            "no-restricted-syntax",
        ]);
    });

    it.each(appComponents)("rejects value imports in %s", async (file) => {
        const code = component(
            '    import { writable } from "svelte/store";\n    const s = import("svelte/store");',
        );
        expect(await importErrors(code, file)).toEqual([
            "@typescript-eslint/no-restricted-imports",
            "no-restricted-syntax",
        ]);
    });

    it("accepts a type-only import", async () => {
        const code = 'import type { Readable } from "svelte/store";';
        expect(await importErrors(code, "app/src/utils/example.ts")).toEqual([]);
    });

    it("leaves files on the allowlist alone", async () => {
        const code =
            'import { writable } from "svelte/store";\nexport const s = import("svelte/store");';
        expect(await importErrors(code, "app/src/stores/toast.ts")).toEqual([]);
    });
});
