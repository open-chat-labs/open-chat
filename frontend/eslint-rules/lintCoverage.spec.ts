// @vitest-environment node
import { ESLint } from "eslint";
import { expect, it, vi } from "vitest";

// Creating the first ESLint instance loads every plugin, which can take longer than the default 5s.
vi.setConfig({ testTimeout: 30_000 });

const frontendRoot = new URL("..", import.meta.url).pathname;

/**
 * Invariant: `npm run lint` checks Svelte components with the rules that apply to .ts files.
 * Before this, the config matched only three Router components and silently skipped the rest.
 */
it("lints a Svelte component with the .ts rules", async () => {
    const eslint = new ESLint({ cwd: frontendRoot });
    const [result] = await eslint.lintText('<script lang="ts">\n    let x: any;\n</script>\n', {
        filePath: "app/src/components/Example.svelte",
    });
    expect(result.messages.map((m) => m.ruleId)).toContain("@typescript-eslint/no-explicit-any");
});
