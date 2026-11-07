import { vi } from "vitest";

const mocks = vi.hoisted(() => ({
    tauri: false,
    shareSheet: vi.fn<(text: string) => Promise<void>>(async () => {}),
    success: vi.fn(),
    failure: vi.fn(),
}));

vi.mock("@shared", async (original) => ({
    ...(await original<object>()),
    isTauriApp: () => mocks.tauri,
}));
vi.mock("tauri-plugin-oc-api", () => ({ share: mocks.shareSheet }));
vi.mock("../stores/toast", () => ({
    toastStore: { showSuccessToast: mocks.success, showFailureToast: mocks.failure },
}));

const { shareLink } = await import("./share");

const URL = "https://oc.app/?ref=abc";
const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});

function webShare(share: ((data: ShareData) => Promise<void>) | undefined) {
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
}

beforeEach(() => {
    mocks.tauri = false;
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
