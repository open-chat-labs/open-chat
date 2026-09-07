import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = resolve(__dirname, "../../../..");

function source(path: string): string {
    return readFileSync(resolve(REPOSITORY_ROOT, path), "utf8");
}

function workflowStep(workflow: string, name: string): string {
    const start = workflow.indexOf(`- name: ${name}`);
    expect(start, `workflow step ${name}`).toBeGreaterThanOrEqual(0);
    const next = /\r?\n[ \t]+- name:/.exec(workflow.slice(start + 1));
    return workflow.slice(start, next === null ? undefined : start + 1 + next.index);
}

describe("on-device inference packaging", () => {
    it("builds both Android release variants with the inference runtime", () => {
        const workflow = source(".github/workflows/android_release.yaml");
        const full = workflowStep(workflow, "Build Android APK (Full)");
        const store = workflowStep(workflow, "Build Android AAB (Store)");

        expect(full).toMatch(/cargo tauri android build[^\n]*--apk(?:\s|$)/);
        expect(full).toMatch(/cargo tauri android build[^\n]*--features inference(?:\s|$)/);
        expect(full).not.toMatch(/--aab|--features[^\n]*\bstore\b/);
        expect(full).toContain('"./openchat_${VERSION}_full.apk"');
        expect(full).toContain('OC_APP_STORE: "false"');
        expect(store).toMatch(/cargo tauri android build[^\n]*--aab(?:\s|$)/);
        expect(store).toMatch(
            /cargo tauri android build[^\n]*--features (?:inference,store|store,inference)(?:\s|$)/,
        );
        expect(store).not.toMatch(/--apk/);
        expect(store).toContain('"./openchat_${VERSION}_store.aab"');
        expect(store).toContain('OC_APP_STORE: "true"');
    });

    it("compiles the actual app crate with both shipping feature sets in CI", () => {
        const workflow = source(".github/workflows/on_device_model_security.yaml");

        expect(workflow).toMatch(/cargo check --locked -p open-chat --features inference(?:\s|$)/);
        expect(workflow).toMatch(
            /cargo check --locked -p open-chat --features (?:inference,store|store,inference)(?:\s|$)/,
        );
    });

    it("runs the packaging contract through the repository's real frontend test command", () => {
        const workflow = source(".github/workflows/on_device_model_security.yaml");
        const contracts = workflowStep(workflow, "Run all local-model frontend contracts");

        expect(contracts).toContain("npm test --");
        const command = /\n {8}run: >-\r?\n((?: {10}[^\r\n]+\r?\n?)+)/.exec(contracts);
        expect(command).not.toBeNull();
        const words = command![1].trim().split(/\s+/);
        expect(words.splice(0, 3)).toEqual(["npm", "test", "--"]);
        expect(
            words.some((filter) =>
                "app/src/utils/onDeviceInferencePackaging.test.ts".includes(filter),
            ),
        ).toBe(true);
        expect(contracts).not.toContain("npm --workspace app");
    });

    it("forwards the app inference feature to the native plugin", () => {
        const manifest = source("frontend/src-tauri/Cargo.toml");

        expect(manifest).toMatch(/inference\s*=\s*\["tauri-plugin-oc\/inference"\]/);
    });

    it("excludes debug telemetry from default native dependencies and shipping features", () => {
        const manifest = source("frontend/src-tauri/Cargo.toml");
        const app = source("frontend/src-tauri/src/lib.rs");
        const workflow = source(".github/workflows/android_release.yaml");

        expect(manifest).toMatch(/tauri-plugin-devtools\s*=\s*\{[^}]*optional\s*=\s*true[^}]*\}/);
        expect(manifest).toMatch(/devtools\s*=\s*\["dep:tauri-plugin-devtools"\]/);
        expect(manifest).not.toMatch(/default\s*=\s*\[[^\]]*"devtools"/);
        expect(app).toContain('#[cfg(all(debug_assertions, feature = "devtools"))]');
        expect(workflow).not.toMatch(/--features[^\n]*\bdevtools\b/);
    });
});
