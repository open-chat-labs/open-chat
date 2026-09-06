import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { get } from "svelte/store";
import { describe, expect, test, vi } from "vitest";

vi.mock("@daily-co/daily-js", () => {
    throw new Error("@daily-co/daily-js must not be loaded when stores/video is imported");
});

describe("stores/video", () => {
    test("the real transform emits no type-only client or Daily SDK import", () => {
        const source = readFileSync(path.join(import.meta.dirname, "video.ts"), "utf8");
        // esbuild requires one native TextEncoder/Uint8Array realm; jsdom mixes
        // realms, so run the installed compiler in Node with the real tsconfig.
        const code = execFileSync(
            process.execPath,
            [
                "-e",
                "const fs=require('node:fs'); const {transformSync}=require('esbuild'); " +
                    "process.stdout.write(transformSync(fs.readFileSync(0,'utf8'), " +
                    "{loader:'ts',format:'esm',tsconfigRaw:fs.readFileSync('tsconfig.json','utf8')}).code);",
            ],
            {
                cwd: path.resolve(import.meta.dirname, "../../.."),
                input: source,
                encoding: "utf8",
                windowsHide: true,
                timeout: 4_000,
            },
        );
        expect(code).not.toContain("@client");
        expect(code).not.toContain("@daily-co/daily-js");
    });

    test("importing the store does not load @daily-co/daily-js", async () => {
        await expect(import("./video")).resolves.toBeDefined();
    });

    test("incomingVideoCall ignores a second ring for the same messageId", async () => {
        const { incomingVideoCall } = await import("./video");
        const chatId = { kind: "direct_chat", userId: "u1" } as const;
        incomingVideoCall.set({ chatId, userId: "u1", messageId: 1n, callType: "default" });
        expect(get(incomingVideoCall)?.messageId).toBe(1n);
        incomingVideoCall.set(undefined);
        incomingVideoCall.set({ chatId, userId: "u1", messageId: 1n, callType: "default" });
        expect(get(incomingVideoCall)).toBeUndefined();
        incomingVideoCall.set({ chatId, userId: "u1", messageId: 2n, callType: "default" });
        expect(get(incomingVideoCall)?.messageId).toBe(2n);
    });

    test("joining / setView / endCall lifecycle", async () => {
        const { activeVideoCall, microphone, camera } = await import("./video");
        const chatId = { kind: "direct_chat", userId: "u1" } as const;
        activeVideoCall.joining(chatId, "default");
        expect(get(activeVideoCall)).toMatchObject({
            status: "joining",
            chatId,
            view: "default",
            accessRequests: [],
            isOwner: false,
        });
        activeVideoCall.setView("minimised");
        expect(get(activeVideoCall)?.view).toBe("minimised");
        microphone.set(true);
        camera.set(true);
        activeVideoCall.endCall();
        expect(get(activeVideoCall)).toBeUndefined();
        expect(get(microphone)).toBe(false);
        expect(get(camera)).toBe(false);
    });

    test("the lazy-loading guard rejects an attempted Daily SDK import", async () => {
        await expect(import("@daily-co/daily-js")).rejects.toThrow();
    });
});
