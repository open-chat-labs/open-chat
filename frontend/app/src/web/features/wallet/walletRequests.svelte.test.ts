import { describe, expect, test } from "vitest";
import { newest, numbered, panelRequests } from "./walletRequests.svelte";

describe("the wallet's requests", () => {
    test("the newest of the page's and the panel's wins, whichever came last", () => {
        const page = numbered({ view: "token", token: "icp" });
        panelRequests.send({ view: "browse" });
        expect(newest(page, panelRequests.latest)?.view).toBe("browse");
        const next = numbered({ view: "all" });
        expect(newest(next, panelRequests.latest)).toBe(next);
        expect(newest(undefined, next)).toBe(next);
    });
});
