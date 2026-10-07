// @vitest-environment node
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const frontendRoot = new URL("..", import.meta.url).pathname;

const component = `<script lang="ts">
    let value: any = $state(0);
</script>

<p>{value}</p>
`;

/**
 * Invariant: `npm run lint` checks every Svelte component with the same rules as the .ts files.
 * Before this, the config matched only three Router components and silently skipped the rest.
 */
describe("eslint config covers Svelte components", () => {
    const eslint = new ESLint({ cwd: frontendRoot });

    it.each([
        "app/src/components/home/Example.svelte",
        "app/src/components_mobile/home/Example.svelte",
        "app/src/components_shared/Example.svelte",
    ])("reports rule violations in %s", async (filePath) => {
        const [result] = await eslint.lintText(component, { filePath });
        const rules = result.messages.map((m) => m.ruleId);

        expect(rules).toContain("@typescript-eslint/no-explicit-any");
    });
});
