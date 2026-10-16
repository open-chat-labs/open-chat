import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NATIVE_MARKER } from "./src/utils/shellUpdate";

const SCRIPT = join(__dirname, "android_native_version.sh");

let repo: string;

function git(...args: string[]) {
    execFileSync("git", args, { cwd: repo, stdio: "pipe" });
}

function release(tag: string, files: Record<string, string>) {
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(repo, path)), { recursive: true });
        writeFileSync(join(repo, path), content);
    }
    git("add", "-A");
    git("commit", "-q", "--allow-empty", "-m", tag);
    git("tag", tag);
}

function releaseBody(version: string, body = "Release notes"): string {
    return execFileSync("bash", [SCRIPT, version], { cwd: repo, encoding: "utf8", input: body });
}

// Read back the way the app reads it, so CI and client cannot disagree on the
// marker's format.
function nativeVersion(version: string): string | undefined {
    return NATIVE_MARKER.exec(releaseBody(version))?.[1];
}

describe("android_native_version.sh", () => {
    beforeEach(() => {
        repo = mkdtempSync(join(tmpdir(), "native-version-"));
        git("init", "-q");
        git("config", "user.email", "test@example.com");
        git("config", "user.name", "test");
        release("v2.0.100-android", {
            "frontend/tauri-plugin-oc/src/lib.rs": "a",
            "frontend/app/src/main.ts": "a",
        });
    });

    afterEach(() => rmSync(repo, { recursive: true, force: true }));

    it("carries the last native change forward through web-only releases", () => {
        release("v2.0.101-android", { "frontend/app/src/main.ts": "b" });
        release("v2.0.102-android", { "frontend/app/src/main.ts": "c" });
        expect(nativeVersion("2.0.102")).toBe("2.0.100");
    });

    it("starts again at a release that changes native code", () => {
        release("v2.0.101-android", { "frontend/app/src/main.ts": "b" });
        release("v2.0.102-android", { "frontend/tauri-plugin-oc/src/lib.rs": "b" });
        expect(nativeVersion("2.0.102")).toBe("2.0.102");
    });

    it("counts a change to the Android app module as native", () => {
        release("v2.0.101-android", {
            "frontend/src-tauri/gen/android/app/src/main/AndroidManifest.xml": "b",
        });
        expect(nativeVersion("2.0.101")).toBe("2.0.101");
    });

    it("ignores tags newer than the release being built", () => {
        git("tag", "v2.0.200-android", "HEAD");
        release("v2.0.101-android", { "frontend/app/src/main.ts": "b" });
        expect(nativeVersion("2.0.101")).toBe("2.0.100");
    });

    it("replaces a marker left by an earlier run and keeps the notes", () => {
        const body = releaseBody("2.0.100", "Notes\n<!-- native-version: 2.0.1 -->\n");
        expect(body).toContain("Notes");
        expect(body.match(new RegExp(NATIVE_MARKER, "g"))).toEqual([
            "<!-- native-version: 2.0.100 -->",
        ]);
    });
});
