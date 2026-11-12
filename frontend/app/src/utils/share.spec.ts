import type { ImageContent, Message, MessageFormatter } from "@client";
import { vi } from "vitest";

const mocks = vi.hoisted(() => ({
    tauri: false,
    android: false,
    shareSheet: vi.fn<(text: string) => Promise<void>>(async () => {}),
    canShareFiles: vi.fn<() => Promise<void>>(async () => {}),
    shareFiles: vi.fn<(files: File[], text?: string, title?: string) => Promise<void>>(
        async () => {},
    ),
    success: vi.fn(),
    failure: vi.fn(),
}));

vi.mock("@shared", async (original) => ({
    ...(await original<object>()),
    isTauriApp: () => mocks.tauri,
    isAndroidTauriApp: () => mocks.android,
}));
vi.mock("tauri-plugin-oc-api", () => ({
    share: mocks.shareSheet,
    canShareFiles: mocks.canShareFiles,
    shareFiles: mocks.shareFiles,
}));
vi.mock("../stores/toast", () => ({
    toastStore: { showSuccessToast: mocks.success, showFailureToast: mocks.failure },
}));

const { canShareMessage, shareLink, shareMessageOrFail } = await import("./share");
const { detectShellFileSharing } = await import("./native/shellShare.svelte");

const URL = "https://oc.app/?ref=abc";
const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});

function webShare(share: ((data: ShareData) => Promise<void>) | undefined) {
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
}

beforeEach(() => {
    mocks.tauri = false;
    mocks.android = false;
    mocks.shareSheet.mockReset().mockResolvedValue(undefined);
    mocks.success.mockReset();
    mocks.failure.mockReset();
    writeText.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    webShare(undefined);
});

describe("sharing a link", () => {
    test("uses the Web Share API where the browser has it", async () => {
        const share = vi.fn(async () => {});
        webShare(share);
        await shareLink(URL);
        expect(share).toHaveBeenCalledWith({ url: URL, files: [] });
        expect(mocks.shareSheet).not.toHaveBeenCalled();
        expect(writeText).not.toHaveBeenCalled();
    });

    test("says nothing when the user closes the browser's share sheet", async () => {
        webShare(async () => {
            throw new DOMException("closed", "AbortError");
        });
        await shareLink(URL);
        expect(mocks.failure).not.toHaveBeenCalled();
    });

    // the apps' WebViews have no Web Share API: it only copied the link there
    test("opens the system share sheet in the apps, rather than copying it", async () => {
        mocks.tauri = true;
        await shareLink(URL);
        expect(mocks.shareSheet).toHaveBeenCalledWith(URL);
        expect(writeText).not.toHaveBeenCalled();
    });

    test("copies it in an app whose shell has no share sheet yet", async () => {
        mocks.tauri = true;
        mocks.shareSheet.mockRejectedValue("unknown command");
        vi.spyOn(console, "warn").mockImplementation(() => {});
        await shareLink(URL);
        expect(writeText).toHaveBeenCalledWith(URL);
        expect(mocks.success).toHaveBeenCalled();
    });

    test("copies it in a browser without the Web Share API", async () => {
        await shareLink(URL);
        expect(mocks.shareSheet).not.toHaveBeenCalled();
        expect(writeText).toHaveBeenCalledWith(URL);
        expect(mocks.success).toHaveBeenCalled();
    });

    test("says so when it can't copy it either", async () => {
        writeText.mockRejectedValue(new Error("denied"));
        await shareLink(URL);
        expect(mocks.failure).toHaveBeenCalled();
    });
});

describe("sharing a message in the Android app, whose WebView has no Web Share API", () => {
    const photo: ImageContent = {
        kind: "image_content",
        height: 1,
        width: 1,
        thumbnailData: "",
        mimeType: "image/jpeg",
        blobUrl: "https://blobs.example/photo",
        caption: "look",
    };

    beforeEach(() => {
        mocks.tauri = true;
        mocks.android = true;
        mocks.canShareFiles.mockReset().mockResolvedValue(undefined);
        mocks.shareFiles.mockReset().mockResolvedValue(undefined);
    });

    // Invariant: "can share message" is true on Android for media messages when the shell supports it
    test("offers Share for a photo once the shell says it can share files", async () => {
        await detectShellFileSharing();
        expect(canShareMessage(photo)).toBe(true);
    });

    // Invariant: a new web bundle on a shell older than file sharing offers what it did (no Share)
    test("doesn't on a shell older than that", async () => {
        mocks.canShareFiles.mockRejectedValue("unknown command");
        await detectShellFileSharing();
        expect(canShareMessage(photo)).toBe(false);
    });

    // Invariant: Share sends the photo itself to the share sheet, not just its caption
    test("hands the photo itself, with its caption, to the shell's share sheet", async () => {
        await detectShellFileSharing();
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response("jpeg")),
        );
        const msg = { content: photo, sender: "them" } as Message;

        const ok = await shareMessageOrFail({} as MessageFormatter, "me", false, msg, new Map());

        expect(ok).toBe(true);
        const [files, text] = mocks.shareFiles.mock.calls[0];
        expect(files.map((f) => [f.name, f.type])).toEqual([["image.jpg", "image/jpeg"]]);
        expect(text).toBe("look");
        vi.unstubAllGlobals();
    });
});
