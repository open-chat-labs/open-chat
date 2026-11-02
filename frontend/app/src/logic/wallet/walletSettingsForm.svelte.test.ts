import type { WalletConfig } from "@client";
import { describe, expect, test, vi } from "vitest";
import { WalletSettingsForm } from "./walletSettingsForm.svelte";

const defaults = () => new Set(["chat", "icp"]);

function form(stored: WalletConfig, ok = true) {
    const client = { setWalletConfig: vi.fn(async () => ok) };
    return { form: new WalletSettingsForm(client, () => stored, defaults), client };
}

describe("the wallet settings form", () => {
    test("6d invariant 4: editing never changes the stored config in place", () => {
        const stored: WalletConfig = { kind: "manual_wallet", tokens: new Set(["a"]) };
        const { form: f } = form(stored);
        f.toggleToken("b");
        f.toggleToken("a");
        expect([...stored.tokens]).toEqual(["a"]);
        expect(f.config).toEqual({ kind: "manual_wallet", tokens: new Set(["b"]) });
    });

    test("6d invariant 4: it saves on close only when the config differs", async () => {
        const stored: WalletConfig = { kind: "auto_wallet", minDollarValue: 1 };
        const unchanged = form(stored);
        expect(await unchanged.form.save()).toBe("unchanged");
        expect(unchanged.client.setWalletConfig).not.toHaveBeenCalled();

        const changed = form(stored);
        changed.form.setMinimum(5);
        expect(await changed.form.save()).toBe("saved");
        expect(changed.client.setWalletConfig).toHaveBeenCalledWith({
            kind: "auto_wallet",
            minDollarValue: 5,
        });

        const failing = form(stored, false);
        failing.form.setMinimum(5);
        expect(await failing.form.save()).toBe("failed");
    });

    test("switching mode starts from the defaults or $0; going back restores the stored config", () => {
        const stored: WalletConfig = { kind: "auto_wallet", minDollarValue: 7 };
        const { form: f } = form(stored);
        f.selectMode("manual_wallet");
        expect(f.config).toEqual({ kind: "manual_wallet", tokens: new Set(["chat", "icp"]) });
        f.selectMode("auto_wallet");
        expect(f.config).toEqual({ kind: "auto_wallet", minDollarValue: 7 });

        const manual = form({ kind: "manual_wallet", tokens: new Set(["a"]) }).form;
        manual.toggleMode();
        expect(manual.config).toEqual({ kind: "auto_wallet", minDollarValue: 0 });
    });

    test("a minimum that isn't a number isn't saved, and says so", async () => {
        const { form: f, client } = form({ kind: "auto_wallet", minDollarValue: 1 });
        f.setMinimum(Number("abc"));
        expect(f.valid).toBe(false);
        expect(await f.save()).toBe("invalid");
        expect(client.setWalletConfig).not.toHaveBeenCalled();
    });
});
