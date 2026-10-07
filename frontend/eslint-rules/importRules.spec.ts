// @vitest-environment node
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const frontendRoot = new URL("..", import.meta.url).pathname;
const eslint = new ESLint({ cwd: frontendRoot });

async function restrictedImportErrors(code: string, filePath: string): Promise<string[]> {
    const [result] = await eslint.lintText(code, { filePath });
    return result.messages
        .filter(
            (m) =>
                m.ruleId === "no-restricted-imports" ||
                m.ruleId === "@typescript-eslint/no-restricted-imports",
        )
        .map((m) => m.ruleId!);
}

function component(script: string): string {
    return `<script lang="ts">\n${script}\n</script>\n`;
}

/** Invariant: the app imports the client only through `@client`, and never the agent or worker. */
describe("app layering", () => {
    it.each([
        'import { x } from "@agent/services/openchatAgent";',
        'import { x } from "@worker/worker";',
        'import { x } from "@client/state/localStorageStore";',
        'import { x } from "../../../openchat-agent/src/services/openchatAgent";',
        'import { x } from "../../../openchat-client/src/utils/time";',
    ])("rejects %s in app code", async (line) => {
        expect(await restrictedImportErrors(line, "app/src/utils/example.ts")).toEqual([
            "no-restricted-imports",
        ]);
        expect(
            await restrictedImportErrors(component(line), "app/src/components/Example.svelte"),
        ).toEqual(["no-restricted-imports"]);
    });

    it("accepts the client's entry point and shared", async () => {
        const code = 'import { x } from "@client";\nimport { y } from "@shared";';
        expect(await restrictedImportErrors(code, "app/src/utils/example.ts")).toEqual([]);
    });

    it("lets specs reach inside the client but not the agent", async () => {
        const path = "app/src/utils/example.spec.ts";
        expect(
            await restrictedImportErrors(
                'import { x } from "@client/state/community/server";',
                path,
            ),
        ).toEqual([]);
        expect(await restrictedImportErrors('import { x } from "@agent/x";', path)).toEqual([
            "no-restricted-imports",
        ]);
    });
});

/** Invariant: no new code imports svelte/store values; existing users are on a fixed allowlist. */
describe("svelte/store", () => {
    it.each([
        "app/src/utils/example.ts",
        "openchat-client/src/state/example.ts",
        "openchat-shared/src/utils/example.ts",
    ])("rejects a value import in %s", async (path) => {
        expect(
            await restrictedImportErrors('import { writable } from "svelte/store";', path),
        ).toEqual(["@typescript-eslint/no-restricted-imports"]);
    });

    it("rejects a value import in a component", async () => {
        const code = component('    import { writable } from "svelte/store";');
        expect(await restrictedImportErrors(code, "app/src/components/Example.svelte")).toEqual([
            "@typescript-eslint/no-restricted-imports",
        ]);
    });

    it("accepts a type-only import", async () => {
        const code = 'import type { Readable } from "svelte/store";';
        expect(await restrictedImportErrors(code, "app/src/utils/example.ts")).toEqual([]);
    });

    it("leaves files on the allowlist alone", async () => {
        const code = 'import { writable } from "svelte/store";';
        expect(await restrictedImportErrors(code, "app/src/stores/toast.ts")).toEqual([]);
    });
});
