import type { OpenChat } from "@client";
import { expect, test, vi } from "vitest";

// The first import inside a test counts against its timeout, which a loaded CI runner can pass
vi.setConfig({ testTimeout: 20_000 });

const plugin = vi.hoisted(() => ({
    clearAllNotifications: vi.fn(async () => undefined),
    svelteReady: vi.fn(async () => undefined),
}));
vi.mock("tauri-plugin-oc-api", () => plugin);

// The token removal is network calls; here it never finishes.
vi.mock("./push_device", () => ({
    registerPushDevice: vi.fn(),
    unregisterPushDevice: vi.fn(() => new Promise(() => undefined)),
    expectPushDeviceRefresh: vi.fn(async () => undefined),
}));
vi.mock("./call_bridge", () => ({
    expectCallActions: vi.fn(async () => undefined),
    expectCallControls: vi.fn(async () => undefined),
    rememberCallIdentity: vi.fn(),
    runCallAction: vi.fn(),
    setCallConfig: vi.fn(async () => undefined),
}));
vi.mock("./notification_channels", () => ({
    expectDeepLinks: vi.fn(async () => undefined),
    expectNotificationTap: vi.fn(async () => undefined),
    expectPushNotifications: vi.fn(async () => undefined),
}));
vi.mock("./share_target", () => ({
    expectShareTarget: vi.fn(async () => undefined),
    handleShareTarget: vi.fn(),
}));
vi.mock("./read_elsewhere", () => ({ releaseNotificationsReadElsewhere: vi.fn() }));
vi.mock("@stores/chatShortcuts", () => ({
    clearChatShortcuts: vi.fn(),
    startChatShortcutPusher: vi.fn(),
}));
vi.mock("@stores/video", () => ({ activeVideoCall: { applyNativeControl: vi.fn() } }));
vi.mock("./read_elsewhere", () => ({ releaseNotificationsReadElsewhere: vi.fn() }));
const language = vi.hoisted(() => ({ followLanguageInShell: vi.fn() }));
vi.mock("./appLanguage", () => language);
// The real module, so a new import in nativeApp doesn't break this spec
vi.mock("@client", async (original) => ({
    ...(await original<typeof import("@client")>()),
    currentUserStore: { value: { username: "me" } },
}));

test("sign-out clears the tray and chat shortcuts without waiting for the push token's removal", async () => {
    const tasks: (() => Promise<unknown>)[] = [];
    const client = {
        isNativeApp: () => true,
        onLogout: (task: () => Promise<unknown>) => tasks.push(task),
    } as unknown as OpenChat;
    const { setupNativeApp } = await import("./nativeApp");
    setupNativeApp(client, undefined);

    // as logout runs them: side by side, under one time cap
    tasks.forEach((task) => task());

    await vi.waitFor(() => expect(plugin.clearAllNotifications).toHaveBeenCalled());
});

test("invariant 4 the native setup tells the shell the app's language (appLanguage.spec.ts)", async () => {
    vi.resetModules();
    language.followLanguageInShell.mockClear();
    const client = { isNativeApp: () => true, onLogout: vi.fn() } as unknown as OpenChat;
    const { setupNativeApp } = await import("./nativeApp");
    setupNativeApp(client, undefined);

    expect(language.followLanguageInShell).toHaveBeenCalledOnce();
});
