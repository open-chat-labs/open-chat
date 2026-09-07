import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const APP_DIR = path.resolve(import.meta.dirname, "../..");
const FRONTEND_DIR = path.resolve(APP_DIR, "..");
const REPOSITORY_DIR = path.resolve(FRONTEND_DIR, "..");

describe("Android bundled frontend OTA policy", () => {
    it("defaults sideload APKs to none without inheriting OC_OTA_UPDATES", () => {
        const buildAndroid = fs.readFileSync(path.join(APP_DIR, "build_android.sh"), "utf8");

        expect(buildAndroid).toContain("set -euo pipefail");
        expect(buildAndroid).toContain("${OC_ANDROID_OTA_UPDATES:-none}");
        expect(buildAndroid).toContain("none|patch|minor|major)");
        expect(buildAndroid).toContain('export OC_OTA_UPDATES="${OC_ANDROID_OTA_UPDATES:-none}"');
        expect(buildAndroid).not.toContain("${OC_OTA_UPDATES:-");
        for (const requiredAsset of [
            "build/index.html",
            "build/version",
            "build/ota-policy.json",
            "build/android-rp-id",
        ]) {
            expect(buildAndroid).toContain(requiredAsset);
        }
    });

    it("embeds the validated policy for the native resolver", () => {
        const rollup = fs.readFileSync(path.join(APP_DIR, "rollup.config.mjs"), "utf8");
        const updateManager = fs.readFileSync(
            path.join(FRONTEND_DIR, "tauri-plugin-oc/src/update_manager.rs"),
            "utf8",
        );
        const bundleManager = fs.readFileSync(
            path.join(FRONTEND_DIR, "tauri-plugin-oc/src/bundle_manager.rs"),
            "utf8",
        );

        expect(rollup).toContain('process.env.OC_OTA_UPDATES ?? "none"');
        expect(rollup).toContain('"build/ota-policy.json"');
        expect(rollup).toContain("JSON.stringify({ strategy: otaUpdateStrategy })");
        expect(updateManager).toContain('const OTA_POLICY_ASSET: &str = "ota-policy.json"');
        expect(updateManager).toContain("unwrap_or(OtaUpdateStrategy::None)");
        expect(bundleManager).toContain("if !um.cached_update_allowed()");
    });

    it("allows an explicit local network configuration without changing official defaults", () => {
        const buildAndroid = fs.readFileSync(path.join(APP_DIR, "build_android.sh"), "utf8");
        const rollupExtras = fs.readFileSync(path.join(APP_DIR, "rollup.extras.mjs"), "utf8");

        for (const [name, officialDefault] of [
            ["OC_DFX_NETWORK", "ic"],
            ["OC_IC_URL", "https://icp-api.io"],
            ["OC_WEBAUTHN_ORIGIN", "oc.app"],
            ["OC_BASE_ORIGIN", "https://oc.app"],
            ["OC_ACCOUNT_LINKING_CODES_ENABLED", "false"],
        ]) {
            expect(buildAndroid).toContain(`\${${name}:-${officialDefault}}`);
        }
        expect(buildAndroid).toContain("export OC_BLOB_URL_PATTERN='https://{canisterId}");
        expect(buildAndroid).toContain("export OC_CANISTER_URL_PATH='https://{canisterId}");
        expect(buildAndroid).toContain("${OC_INTERNET_IDENTITY_CANISTER_ID:-");
        expect(buildAndroid).toContain("${OC_INTERNET_IDENTITY_URL:-");
        expect(buildAndroid).toContain("${OC_II_DERIVATION_ORIGIN:-");
        expect(rollupExtras).toContain(
            'setEnvironmentDefault("OC_USER_INDEX_CANISTER", canisters.user_index[dfxNetwork])',
        );
        expect(rollupExtras).not.toContain(
            "process.env.OC_USER_INDEX_CANISTER = canisters.user_index[dfxNetwork]",
        );
    });

    it("keeps official Android release OTA strategies explicitly opted in", () => {
        const workflow = fs.readFileSync(
            path.join(REPOSITORY_DIR, ".github/workflows/android_release.yaml"),
            "utf8",
        );

        expect(workflow).toContain('OC_ANDROID_OTA_UPDATES: "minor"');
        expect(workflow).toContain('OC_ANDROID_OTA_UPDATES: "patch"');
        expect(workflow).not.toMatch(/^\s+OC_OTA_UPDATES:/m);
    });

    it("loads .env as defaults without replacing an explicit caller value", () => {
        const bash =
            process.platform === "win32"
                ? path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Git/bin/bash.exe")
                : "bash";
        if (process.platform === "win32" && !fs.existsSync(bash)) return;

        const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "oc-android-env-"));
        const envFile = path.join(temporaryDirectory, ".env");
        fs.writeFileSync(envFile, "OC_WEBSITE_VERSION=file-version\nOC_FILE_ONLY=file-only\n");
        const helper = path.join(APP_DIR, "source_env_defaults.sh").replaceAll("\\", "/");
        const bashEnvFile = envFile.replaceAll("\\", "/");
        const result = spawnSync(
            bash,
            [
                "-lc",
                `export OC_WEBSITE_VERSION=caller-version; unset OC_FILE_ONLY; source '${helper}'; source_env_defaults '${bashEnvFile}'; printf '%s|%s' "$OC_WEBSITE_VERSION" "$OC_FILE_ONLY"`,
            ],
            { encoding: "utf8" },
        );

        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout).toBe("caller-version|file-only");
    });
});
