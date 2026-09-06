import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
    extractPublicKey,
    publicKeyBuildPlugin,
    resolveDfxInvocation,
    writePublicKeyFile,
} from "../publicKeyBuild.mjs";

const queryResult =
    'variant { Success = "-----BEGIN PUBLIC KEY-----\\nQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=\\n-----END PUBLIC KEY-----\\n" }';
const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
    const directory = await mkdtemp(path.join(tmpdir(), "openchat-public-key-"));
    temporaryDirectories.push(directory);
    return directory;
}

afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(
        temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
    );
});

describe("public key build plugin", () => {
    test("the production Rollup config uses the query plugin and preserves worker generation", async () => {
        const config = await readFile(
            path.resolve(import.meta.dirname, "../rollup.config.mjs"),
            "utf8",
        );
        expect(config).toContain('import { publicKeyBuildPlugin } from "./publicKeyBuild.mjs"');
        expect(config).toMatch(
            /publicKeyBuildPlugin\(\{\s*network: process\.env\.OC_DFX_NETWORK \?\? "local",\s*canister: process\.env\.OC_USER_INDEX_CANISTER,\s*dfxExecutable: process\.env\.OC_DFX_EXECUTABLE,\s*expectedDfxVersion: dfxBuildVersion,\s*\}\)/,
        );
        expect(config).toContain('new URL("../../dfx.json", import.meta.url)');
        expect(config).toContain('typeof dfxBuildVersion !== "string"');
        expect(config).toContain("node ./build-workers.mjs");
        expect(config).not.toContain("scripts/get-public-key.sh");
        expect(config).not.toContain("> ./public/public-key");
    });

    test("uses native dfx on Unix and a WSL login shell without output redirection on Windows", () => {
        const unix = resolveDfxInvocation("local", "linux");
        expect(unix.command).toBe("dfx");
        expect(unix.args).toContain("local");

        const windows = resolveDfxInvocation("local", "win32", "OpenChatDistro", "aaaaa-aa");
        expect(windows.command).toBe("wsl.exe");
        expect(windows.args.slice(0, 6)).toEqual([
            "--distribution",
            "OpenChatDistro",
            "--",
            "bash",
            "--login",
            "-c",
        ]);
        expect(windows.args[6]).toContain("exec -- 'dfx' '--identity' 'anonymous'");
        expect(windows.args[6]).toContain("'(record { })'");
        expect(windows.args[6]).toContain("'aaaaa-aa' 'public_key'");
        expect(windows.args[6]).not.toContain(">");
        expect(windows.args).not.toContain("../../scripts/get-public-key.sh");
    });

    test("keeps explicit executable paths as one native argument and quotes WSL shell metacharacters", () => {
        const executable = "/opt/tool user's/dfx; $(printf unexpected)";
        const unix = resolveDfxInvocation("ic", "linux", undefined, "aaaaa-aa", executable);
        expect(unix.command).toBe(executable);
        expect(unix.args.slice(0, 2)).toEqual(["--identity", "anonymous"]);
        const windows = resolveDfxInvocation("ic", "win32", "Build Tools", "aaaaa-aa", executable);
        expect(windows.args.slice(0, 2)).toEqual(["--distribution", "Build Tools"]);
        expect(windows.args[6]).toBe(
            `exec -- '/opt/tool user'"'"'s/dfx; $(printf unexpected)' '--identity' 'anonymous' 'canister' '--network' 'ic' 'call' '-qq' 'aaaaa-aa' 'public_key' '(record { })' '--query'`,
        );
    });

    test("verifies the selected executable version before issuing the anonymous query", async () => {
        const outputPath = path.join(await temporaryDirectory(), "public-key");
        const calls: Array<{ command: string; args: string[] }> = [];
        const dfxExecutable = "/opt/build tools/dfx";
        await writePublicKeyFile({
            outputPath,
            platform: "win32",
            wslDistro: "Build Tools",
            dfxExecutable,
            expectedDfxVersion: "0.31.0-beta.1",
            runCommand: async (command, args) => {
                calls.push({ command, args });
                return calls.length === 1 ? "dfx 0.31.0-beta.1\r\n" : queryResult;
            },
        });
        expect(calls).toHaveLength(2);
        expect(calls[0]).toEqual({
            command: "wsl.exe",
            args: [
                "--distribution",
                "Build Tools",
                "--",
                "bash",
                "--login",
                "-c",
                "exec -- '/opt/build tools/dfx' '--version'",
            ],
        });
        expect(calls[1]?.args[6]).toContain(
            "exec -- '/opt/build tools/dfx' '--identity' 'anonymous'",
        );
        expect(await readFile(outputPath, "utf8")).toBe(extractPublicKey(queryResult));
    });

    test.each(["dfx 0.27.0", "dfx 0.31.0-beta.10", "unexpected output"])(
        "rejects version response %s before query or key replacement",
        async (versionResponse) => {
            const directory = await temporaryDirectory();
            const outputPath = path.join(directory, "public-key");
            await writeFile(outputPath, "previous-key", "utf8");
            const calls: string[][] = [];
            await expect(
                writePublicKeyFile({
                    outputPath,
                    platform: "linux",
                    expectedDfxVersion: "0.31.0-beta.1",
                    runCommand: async (_command, args) => {
                        calls.push(args);
                        return versionResponse;
                    },
                }),
            ).rejects.toThrow("expected dfx 0.31.0-beta.1");
            expect(calls).toEqual([["--version"]]);
            expect(await readFile(outputPath, "utf8")).toBe("previous-key");
            expect(await readdir(directory)).toEqual(["public-key"]);
        },
    );

    test("uses the optional executable environment value without changing installed defaults", async () => {
        vi.stubEnv("OC_DFX_EXECUTABLE", "/opt/custom dfx/dfx");
        const outputPath = path.join(await temporaryDirectory(), "public-key");
        const commands: string[] = [];
        await writePublicKeyFile({
            outputPath,
            platform: "linux",
            expectedDfxVersion: "0.31.0-beta.1",
            runCommand: async (command, args) => {
                commands.push(command);
                return args[0] === "--version" ? "dfx 0.31.0-beta.1\n" : queryResult;
            },
        });
        expect(commands).toEqual(["/opt/custom dfx/dfx", "/opt/custom dfx/dfx"]);
    });

    test("extracts a standard LF-delimited PEM without Candid escape sequences", () => {
        const publicKey = extractPublicKey(queryResult);
        expect(publicKey).toBe(
            "-----BEGIN PUBLIC KEY-----\nQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=\n-----END PUBLIC KEY-----\n",
        );
        expect(publicKey).not.toContain("\\n");
        expect(() => extractPublicKey("variant { NotInitialised }")).toThrow(
            "did not return a PEM public key",
        );
        expect(() =>
            extractPublicKey(
                'variant { Success = "-----BEGIN PUBLIC KEY-----\\n!\\n-----END PUBLIC KEY-----" }',
            ),
        ).toThrow("invalid PEM public key");
    });

    test("atomically replaces the destination only after a valid query", async () => {
        const directory = await temporaryDirectory();
        const outputPath = path.join(directory, "public-key");
        await writeFile(outputPath, "previous-key", "utf8");

        await expect(
            writePublicKeyFile({
                outputPath,
                platform: "win32",
                runCommand: async () => {
                    throw new Error("dfx failed");
                },
            }),
        ).rejects.toThrow("dfx failed");
        expect(await readFile(outputPath, "utf8")).toBe("previous-key");

        await expect(
            writePublicKeyFile({
                outputPath,
                platform: "win32",
                runCommand: async () => "variant { NotInitialised }",
            }),
        ).rejects.toThrow("did not return a PEM public key");
        expect(await readFile(outputPath, "utf8")).toBe("previous-key");
        expect(await readdir(directory)).toEqual(["public-key"]);

        const calls: Array<{ command: string; args: string[] }> = [];
        await writePublicKeyFile({
            network: "local",
            outputPath,
            platform: "win32",
            runCommand: async (command, args) => {
                calls.push({ command, args });
                return queryResult;
            },
        });
        expect(calls).toHaveLength(1);
        expect(calls[0]?.command).toBe("wsl.exe");
        expect(await readFile(outputPath, "utf8")).toBe(extractPublicKey(queryResult));
        expect(await readdir(directory)).toEqual(["public-key"]);
    });

    test("propagates generation failures from buildStart", async () => {
        const plugin = publicKeyBuildPlugin({
            runCommand: async () => {
                throw new Error("query unavailable");
            },
        });
        await expect(plugin.buildStart()).rejects.toThrow("query unavailable");
    });
});
