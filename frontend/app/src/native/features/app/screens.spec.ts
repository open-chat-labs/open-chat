import { describe, expect, test, vi } from "vitest";

// An app store build moves no crypto (the epic's store build; invariant 6): it has no wallet, so
// none of the wallet's screens (the root, a token's page, Send, Receive and Swap) is in it.
describe("an app store build's screens", () => {
    test("leave out the wallet's, flows and all", async () => {
        vi.resetModules();
        vi.doMock("@src/utils/features", async (original) => ({
            ...(await original<typeof import("@src/utils/features")>()),
            disableWalletFeature: true,
        }));
        const { screens } = await import("./screens");
        expect(screens.wallet).toBeUndefined();
        expect(screens.token).toBeUndefined();
        expect(screens.wallet_flow).toBeUndefined();
        vi.doUnmock("@src/utils/features");
    });

    test("a full build has them", async () => {
        vi.resetModules();
        vi.doMock("@src/utils/features", async (original) => ({
            ...(await original<typeof import("@src/utils/features")>()),
            disableWalletFeature: false,
        }));
        const { screens } = await import("./screens");
        expect(screens.wallet).toBeDefined();
        expect(screens.wallet_flow).toBeDefined();
        vi.doUnmock("@src/utils/features");
    });
});
