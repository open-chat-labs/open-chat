// @vitest-environment node
import { ESLint } from "eslint";
import { expect, it } from "vitest";

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
