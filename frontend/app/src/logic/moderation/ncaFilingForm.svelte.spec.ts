import type { AuthorityReportTokenResponse } from "@client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { NcaFilingForm } from "./ncaFilingForm.svelte";

function client(recorded = true) {
    const record = vi.fn(async () => recorded);
    const token = vi.fn(
        async (): Promise<AuthorityReportTokenResponse> =>
            ({
                kind: "success",
                vaultToken: "v",
                submitterToken: "s",
            }) as AuthorityReportTokenResponse,
    );
    return { recordAuthorityReportFiled: record, authorityReportToken: token };
}

function fill(form: NcaFilingForm) {
    form.firstName = "A";
    form.lastName = "B";
    form.phone = "123";
    form.email = "a@b.c";
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("the filing form", () => {
    test("starts automated where the service is configured, else manual; priority from urgency", () => {
        const auto = new NcaFilingForm(client(), 1n, true, "https://nca", false);
        expect(auto.mode).toBe("auto");
        expect(auto.priority).toBe("P1");
        const manual = new NcaFilingForm(client(), 1n, false, "", false);
        expect(manual.mode).toBe("manual");
        expect(manual.priority).toBe("P3");
        expect(manual.autoAvailable).toBe(false);
    });

    test("out of hours, P1 and P2 need the phone call acknowledged", () => {
        const form = new NcaFilingForm(client(), 1n, true, "https://nca", true);
        fill(form);
        expect(form.needsOohAck).toBe(true);
        expect(form.autoValid).toBe(false);
        form.oohAcknowledged = true;
        expect(form.autoValid).toBe(true);
        form.oohAcknowledged = false;
        form.priority = "P3";
        expect(form.autoValid).toBe(true);
    });

    test("every contact field is needed", () => {
        const form = new NcaFilingForm(client(), 1n, false, "https://nca", false);
        fill(form);
        form.email = " ";
        expect(form.autoValid).toBe(false);
    });

    test("a manual filing records the trimmed reference, with the report's urgency", async () => {
        const c = client();
        const form = new NcaFilingForm(c, 4n, true, "", false);
        expect(await form.submitManual()).toBeUndefined();
        form.reference = "  URN1 ";
        expect(await form.submitManual()).toEqual({ kind: "filed", portalReference: "URN1" });
        expect(c.recordAuthorityReportFiled).toHaveBeenCalledWith(4n, "URN1", true, false);
    });

    test("a manual filing that isn't recorded says so", async () => {
        const form = new NcaFilingForm(client(false), 4n, false, "", false);
        form.reference = "URN1";
        expect(await form.submitManual()).toBeUndefined();
        expect(form.failed).toBe(true);
        expect(form.busy).toBe(false);
    });

    test("an automated filing hands the tokens to the service; its refusal is shown", async () => {
        const fetch = vi.fn(async () => ({ status: 202 }));
        vi.stubGlobal("fetch", fetch);
        const form = new NcaFilingForm(client(), 4n, false, "https://nca", false);
        expect(await form.submitAuto()).toBeUndefined();
        fill(form);
        expect(await form.submitAuto()).toEqual({ kind: "started" });
        fetch.mockResolvedValueOnce({ status: 500 });
        expect(await form.submitAuto()).toBeUndefined();
        expect(form.failed).toBe(true);
        expect(form.failureMessage).toBe("Service answered 500");
    });
});
