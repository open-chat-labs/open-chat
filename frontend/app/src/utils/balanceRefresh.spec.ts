import type { OpenChat } from "@client";
import type { TokenState } from "@src/logic/wallet/walletState.svelte";
import { toastStore } from "@src/stores/toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { refreshBalanceOrToast } from "./balanceRefresh";

/** Invariant: a balance that couldn't be refreshed says so (the gate, payment, wallet and receive
 * screens' only toast for it); one that refreshed says nothing. */
describe("refreshing a balance from a screen", () => {
    afterEach(() => vi.restoreAllMocks());

    const tokenState = (failure: unknown) =>
        ({ refreshBalance: vi.fn(async () => failure) }) as unknown as TokenState;

    test("shows the failure it was given, and nothing when it refreshed", async () => {
        const toast = vi.spyOn(toastStore, "showFailureToast").mockImplementation(() => {});
        const failure = { kind: "resource_key", key: "unableToRefreshAccountBalance" };
        await refreshBalanceOrToast(tokenState(failure), {} as OpenChat);
        expect(toast).toHaveBeenCalledWith(failure);
        await refreshBalanceOrToast(tokenState(undefined), {} as OpenChat);
        expect(toast).toHaveBeenCalledOnce();
    });
});
