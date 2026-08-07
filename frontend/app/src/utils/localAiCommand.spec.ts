import { beforeEach, describe, expect, it, vi } from "vitest";

// These specs pin the "/ai" composer command contract shared by BOTH composers (v1
// components/home/MessageEntry.svelte and v2 components_mobile/home/MessageEntry.svelte):
// routeComposerInput is the single routing decision each composer must consult, so the two UI
// trees cannot drift apart again.
//
// The runLocalAiCommand cases deliberately mock the LEAF seams (webInference / the native tauri
// plugin) rather than the inferOnDevice facade, so the facade's browser routing — "web model
// attached -> webInfer" (onDeviceInference.ts) — is itself under test. That is exactly the
// reported scenario: /ai typed in a browser with a web GGUF attached must run inference.

const web = vi.hoisted(() => ({
    isWebInferenceReady: vi.fn((): boolean => false),
    webInfer: vi.fn(),
    webModelLabel: vi.fn((): string | undefined => undefined),
}));

vi.mock("./webInference", () => web);

// The native bridge is absent in tests (and in the reported browser scenario); mock the plugin so
// importing the facade never touches Tauri.
vi.mock("tauri-plugin-oc-api", () => ({
    infer: vi.fn(),
    listLocalModels: vi.fn(async () => []),
}));

// The selected-model store persists to localStorage, which node tests don't have.
vi.mock("../stores/onDeviceModels", () => ({
    selectedModelId: {
        subscribe: (run: (value: string) => void) => {
            run("");
            return () => undefined;
        },
    },
}));

import {
    isLocalAiCommandPrefix,
    parseLocalAiCommand,
    routeComposerInput,
    runLocalAiCommand,
} from "./localAiCommand";

describe("routeComposerInput", () => {
    it("routes '/ai <prompt>' to the local model (not the bot selector, not a send)", () => {
        expect(routeComposerInput("/ai hi", { editing: false })).toBe("local-ai");
    });

    it("is case-insensitive ('/AI') and tolerates leading whitespace", () => {
        expect(routeComposerInput("/AI hi", { editing: false })).toBe("local-ai");
        expect(routeComposerInput("  /ai hi", { editing: false })).toBe("local-ai");
    });

    it("routes bare '/ai' to the local branch so the composer can toast 'Type a prompt after /ai'", () => {
        expect(routeComposerInput("/ai", { editing: false })).toBe("local-ai");
    });

    it("still routes real bot commands to the selector", () => {
        expect(routeComposerInput("/poll", { editing: false })).toBe("bot-selector");
        expect(routeComposerInput("/", { editing: false })).toBe("bot-selector");
    });

    it("does not swallow commands that merely share the prefix ('/aix')", () => {
        expect(routeComposerInput("/aix hi", { editing: false })).toBe("bot-selector");
        expect(routeComposerInput("/aid", { editing: false })).toBe("bot-selector");
    });

    it("routes plain text to the normal send path", () => {
        expect(routeComposerInput("hello", { editing: false })).toBe("send");
        expect(routeComposerInput("say /ai", { editing: false })).toBe("send");
    });

    it("editing a message that starts with '/ai' must just edit it (send path)", () => {
        expect(routeComposerInput("/ai fix it", { editing: true })).toBe("send");
    });

    it("editing does not reroute bot commands", () => {
        expect(routeComposerInput("/poll", { editing: true })).toBe("bot-selector");
    });
});

describe("isLocalAiCommandPrefix", () => {
    it("accepts '/ai' with or without a prompt, any case, leading whitespace", () => {
        expect(isLocalAiCommandPrefix("/ai")).toBe(true);
        expect(isLocalAiCommandPrefix("/AI hi")).toBe(true);
        expect(isLocalAiCommandPrefix("  /ai")).toBe(true);
    });

    it("rejects near-misses and mid-text mentions", () => {
        expect(isLocalAiCommandPrefix("/aid")).toBe(false);
        expect(isLocalAiCommandPrefix("/aix hi")).toBe(false);
        expect(isLocalAiCommandPrefix("/a")).toBe(false);
        expect(isLocalAiCommandPrefix("say /ai")).toBe(false);
    });
});

describe("parseLocalAiCommand", () => {
    it("extracts a multi-line prompt (Shift+Enter in the composer)", () => {
        expect(parseLocalAiCommand("/ai line1\nline2")).toBe("line1\nline2");
    });

    it("extracts a simple prompt case-insensitively", () => {
        expect(parseLocalAiCommand("/AI What is 2+2?")).toBe("What is 2+2?");
    });

    it("returns undefined for bare '/ai' and whitespace-only prompts", () => {
        expect(parseLocalAiCommand("/ai")).toBeUndefined();
        expect(parseLocalAiCommand("/ai   ")).toBeUndefined();
    });
});

describe("runLocalAiCommand (through the real inferOnDevice facade)", () => {
    beforeEach(() => {
        web.isWebInferenceReady.mockReset().mockReturnValue(false);
        web.webInfer.mockReset();
    });

    it("browser with NO model attached -> 'unavailable' (composer toasts instead of posting)", async () => {
        const outcome = await runLocalAiCommand("hi");
        expect(outcome.kind).toBe("unavailable");
        expect(web.webInfer).not.toHaveBeenCalled();
    });

    it("browser WITH a web model attached routes to webInfer and returns the trimmed reply", async () => {
        web.isWebInferenceReady.mockReturnValue(true);
        web.webInfer.mockResolvedValue({ kind: "ok", text: "  the answer  " });
        const outcome = await runLocalAiCommand("hi");
        expect(outcome).toEqual({ kind: "ok", reply: "the answer" });
        expect(web.webInfer).toHaveBeenCalledTimes(1);
        expect(web.webInfer.mock.calls[0][0]).toMatchObject({ prompt: "hi" });
    });

    it("forwards staged image bytes to the model (multimodal, e.g. a receipt photo)", async () => {
        web.isWebInferenceReady.mockReturnValue(true);
        web.webInfer.mockResolvedValue({ kind: "ok", text: "a receipt" });
        const image = new Uint8Array([1, 2, 3]);
        await runLocalAiCommand("what is this?", image);
        expect(web.webInfer.mock.calls[0][0].image).toBe(image);
    });

    it("surfaces inference errors as {kind:'error'}", async () => {
        web.isWebInferenceReady.mockReturnValue(true);
        web.webInfer.mockResolvedValue({ kind: "error", error: "boom" });
        expect(await runLocalAiCommand("hi")).toEqual({ kind: "error", error: "boom" });
    });
});
