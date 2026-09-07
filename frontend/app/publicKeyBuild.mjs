import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { URL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PUBLIC_KEY_BEGIN = "-----BEGIN PUBLIC KEY-----";
const PUBLIC_KEY_END = "-----END PUBLIC KEY-----";
const publicKeyPath = new URL("./public/public-key", import.meta.url);

function quoteForPosixShell(value) {
    return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function resolveDfxCommand(dfxArgs, platform, wslDistro, dfxExecutable) {
    if (typeof dfxExecutable !== "string" || dfxExecutable.trim() === "") {
        throw new Error("The dfx build executable must be a non-empty path or command");
    }
    if (platform !== "win32") {
        return { command: dfxExecutable, args: dfxArgs };
    }
    return {
        command: "wsl.exe",
        args: [
            ...(wslDistro ? ["--distribution", wslDistro] : []),
            "--",
            "bash",
            "--login",
            "-c",
            `exec -- ${[dfxExecutable, ...dfxArgs].map(quoteForPosixShell).join(" ")}`,
        ],
    };
}

export function resolveDfxInvocation(
    network,
    platform = process.platform,
    wslDistro,
    canister = "user_index",
    dfxExecutable = "dfx",
) {
    const dfxArgs = [
        "--identity",
        "anonymous",
        "canister",
        "--network",
        network || "local",
        "call",
        "-qq",
        canister,
        "public_key",
        "(record { })",
        "--query",
    ];

    return resolveDfxCommand(dfxArgs, platform, wslDistro, dfxExecutable);
}

export function extractPublicKey(result) {
    const start = result.indexOf(PUBLIC_KEY_BEGIN);
    const end = result.indexOf(PUBLIC_KEY_END, start + PUBLIC_KEY_BEGIN.length);
    if (start < 0 || end < 0) {
        throw new Error("The user_index public_key query did not return a PEM public key");
    }

    const pem = result
        .slice(start, end + PUBLIC_KEY_END.length)
        .replaceAll("\\r\\n", "\n")
        .replaceAll("\\n", "\n")
        .replaceAll("\\r", "\n")
        .replaceAll("\r\n", "\n");
    const body = pem.slice(PUBLIC_KEY_BEGIN.length, -PUBLIC_KEY_END.length).replaceAll(/\s/g, "");
    if (body.length === 0 || !/^[A-Za-z0-9+/=]+$/.test(body)) {
        throw new Error("The user_index public_key query returned an invalid PEM public key");
    }

    return `${pem}\n`;
}

async function runDfx(command, args) {
    const { stdout } = await execFileAsync(command, args, {
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 1024 * 1024,
    });
    return stdout;
}

export async function writePublicKeyFile({
    network = "local",
    canister = process.env.OC_USER_INDEX_CANISTER ?? "user_index",
    outputPath = publicKeyPath,
    platform = process.platform,
    wslDistro = process.env.OC_WSL_DISTRO,
    dfxExecutable = process.env.OC_DFX_EXECUTABLE ?? "dfx",
    expectedDfxVersion,
    runCommand = runDfx,
} = {}) {
    if (expectedDfxVersion !== undefined) {
        if (typeof expectedDfxVersion !== "string" || expectedDfxVersion.trim() === "") {
            throw new Error("The expected dfx build version must be a non-empty string");
        }
        const versionInvocation = resolveDfxCommand(
            ["--version"],
            platform,
            wslDistro,
            dfxExecutable,
        );
        const versionOutput = await runCommand(versionInvocation.command, versionInvocation.args);
        const actualDfxVersion = /^dfx (\S+)$/.exec(versionOutput.trim())?.[1];
        if (actualDfxVersion !== expectedDfxVersion) {
            throw new Error(
                `Cannot build public key: expected dfx ${expectedDfxVersion}, received ${actualDfxVersion ?? "unrecognized --version output"}`,
            );
        }
    }
    const { command, args } = resolveDfxInvocation(
        network,
        platform,
        wslDistro,
        canister,
        dfxExecutable,
    );
    const result = await runCommand(command, args);
    const publicKey = extractPublicKey(result);
    const destination = outputPath instanceof URL ? outputPath : path.resolve(outputPath);
    const directory =
        outputPath instanceof URL ? new URL("./", destination) : path.dirname(destination);
    const filename =
        outputPath instanceof URL
            ? path.basename(destination.pathname)
            : path.basename(destination);
    const temporaryPath =
        outputPath instanceof URL
            ? new URL(`.${filename}.${process.pid}.${randomUUID()}.tmp`, directory)
            : path.join(directory, `.${filename}.${process.pid}.${randomUUID()}.tmp`);

    await mkdir(directory, { recursive: true });
    try {
        await writeFile(temporaryPath, publicKey, { encoding: "utf8", flag: "wx" });
        await rename(temporaryPath, destination);
    } catch (error) {
        await rm(temporaryPath, { force: true }).catch(() => undefined);
        throw error;
    }
}

export function publicKeyBuildPlugin(options = {}) {
    return {
        name: "openchat-public-key",
        async buildStart() {
            await writePublicKeyFile(options);
        },
    };
}
