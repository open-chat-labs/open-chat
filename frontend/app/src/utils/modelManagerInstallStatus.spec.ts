import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function component(path: string): string {
    return readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
}

const managers = [
    ["classic", "../components/home/profile/ModelManager.svelte"],
    ["v2", "../components_mobile/home/user_profile/ModelManager.svelte"],
] as const;

describe.each(managers)("%s native ModelManager install status", (_name, path) => {
    it("offers atomic Update and Remove, never Select, for a stale same-id install", () => {
        const source = component(path);

        expect(source).toContain("nativeModelInstallStatus(entry, localModels)");
        expect(source).toContain('install === "current"');
        expect(source).toContain('install === "update_required"');
        expect(source).toContain("Update required — this downloaded model does not match");
        expect(source).toContain('install === "update_required" ? "Update" : "Download"');
        expect(source).toContain("onClick={() => download(entry)}");
        expect(source).toMatch(
            /install === "update_required" \? "Update" : "Download"[\s\S]*?\{#if install === "update_required"\}[\s\S]*?onClick=\{\(\) => remove\(entry\)\}/,
        );
        expect(source).not.toContain("function isDownloaded");
    });
});
