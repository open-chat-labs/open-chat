import type { OpenChat } from "@client";
import { beforeEach, describe, expect, test, vi } from "vitest";

// The first import inside a test counts against its timeout, which a loaded CI runner can pass
vi.setConfig({ testTimeout: 20_000 });

const tauri = vi.hoisted(() => ({
    invoke: vi.fn(),
    addPluginListener: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => tauri);

vi.mock("@shared", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    isIosTauriApp: () => true,
}));

const device = { alertToken: "alert", voipToken: "voip" };

describe("registering an iPhone", () => {
    const client = { addApnsDevice: vi.fn(async () => undefined) } as unknown as OpenChat;

    beforeEach(() => {
        vi.mocked(client.addApnsDevice).mockClear();
        tauri.invoke.mockResolvedValue(device);
    });

    test("invariant 6 (#10398) login registers the alert and VoIP tokens as one device", async () => {
        const { registerPushDevice } = await import("./push_device");
        registerPushDevice(client);
        await vi.waitFor(() => expect(client.addApnsDevice).toHaveBeenCalledWith(device));
    });

    test("invariant 6 (#10398) a new token registers the whole device again", async () => {
        let refreshed: () => void = () => undefined;
        tauri.addPluginListener.mockImplementation(async (_p, _e, cb: () => void) => {
            refreshed = cb;
            return { unregister: () => undefined };
        });
        const { expectPushDeviceRefresh } = await import("./push_device");
        await expectPushDeviceRefresh(client);

        refreshed();
        await vi.waitFor(() => expect(client.addApnsDevice).toHaveBeenCalledWith(device));
    });
});
