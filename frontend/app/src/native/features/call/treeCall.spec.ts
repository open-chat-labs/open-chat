import type { OpenChat } from "@client";
import { describe, expect, test, vi } from "vitest";

const made = vi.hoisted(() => ({ options: undefined as unknown }));

vi.mock("@src/logic/video/callSession.svelte", () => ({
    CallSession: class {
        constructor(_client: unknown, _frame: unknown, _noAnswer: unknown, options: unknown) {
            made.options = options;
        }
    },
}));

vi.mock("@src/stores/toast", () => ({ toastStore: {} }));
vi.mock("@src/i18n/i18n", () => ({ i18nKey: (key: string) => key }));
vi.mock("@src/logic/video/callFrameOptions", () => ({ callFrameOptions: () => ({}) }));

describe("the native tree's call", () => {
    // #10382 invariant 2: the native tree draws its calls itself, so it never asks for the frame
    test("invariant 2: makes its calls with Daily's call object, never the prebuilt frame", async () => {
        const { createNativeTreeCall } = await import("./treeCall");
        createNativeTreeCall({} as OpenChat);
        expect(made.options).toMatchObject({ mode: "call_object" });
    });
});
