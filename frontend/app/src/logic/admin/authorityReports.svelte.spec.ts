import { describe, expect, test } from "vitest";
import {
    AuthorityReports,
    STANDARD_SLA_MS,
    URGENT_SLA_MS,
    filedFlags,
    formatAge,
    isOverdue,
    parseAuthorityRegister,
} from "./authorityReports.svelte";

const HOUR = 60 * 60 * 1000;

describe("parseAuthorityRegister", () => {
    test("due oldest first, filed newest first", () => {
        const register = parseAuthorityRegister(
            JSON.stringify({
                due: [
                    { report_index: 1, urgent: false, created: 30 },
                    { report_index: 2, urgent: true, created: 10 },
                ],
                filed: [
                    {
                        report_index: 3,
                        portal_reference: "a",
                        filed_at: 5,
                        urgent: false,
                        unverified: false,
                    },
                    {
                        report_index: 4,
                        portal_reference: "b",
                        filed_at: 50,
                        urgent: false,
                        unverified: false,
                    },
                ],
            }),
        );
        expect(register.due.map((r) => r.report_index)).toEqual([2, 1]);
        expect(register.filed.map((r) => r.report_index)).toEqual([4, 3]);
    });

    test("missing lists are empty", () => {
        expect(parseAuthorityRegister("{}")).toEqual({ due: [], filed: [] });
    });
});

describe("isOverdue", () => {
    test("urgent after 24 hours, standard after 72", () => {
        const now = 1_000 * HOUR;
        const urgent = { report_index: 1, urgent: true, created: now - URGENT_SLA_MS };
        const standard = { report_index: 2, urgent: false, created: now - URGENT_SLA_MS - 1 };
        expect(isOverdue(urgent, now)).toBe(false);
        expect(isOverdue({ ...urgent, created: urgent.created - 1 }, now)).toBe(true);
        expect(isOverdue(standard, now)).toBe(false);
        expect(isOverdue({ ...standard, created: now - STANDARD_SLA_MS - 1 }, now)).toBe(true);
    });
});

describe("formatAge", () => {
    test("hours under two days, then days", () => {
        expect(formatAge(5 * HOUR + 1)).toBe("5h");
        expect(formatAge(47 * HOUR)).toBe("47h");
        expect(formatAge(48 * HOUR)).toBe("2d");
        expect(formatAge(80 * HOUR)).toBe("3d");
    });
});

describe("filedFlags", () => {
    const row = {
        report_index: 1,
        portal_reference: "x",
        filed_at: 1,
        urgent: false,
        unverified: false,
    };
    test("lists the flags that are set", () => {
        expect(filedFlags(row)).toBe("");
        expect(filedFlags({ ...row, urgent: true })).toBe("urgent");
        expect(filedFlags({ ...row, urgent: true, unverified: true })).toBe("urgent, unverified");
    });
});

describe("AuthorityReports", () => {
    test("loads the register", async () => {
        const reports = new AuthorityReports({
            authorityReports: async () =>
                JSON.stringify({ due: [{ report_index: 1, urgent: true, created: 1 }] }),
        });
        await reports.load();
        expect(reports.loaded).toBe(true);
        expect(reports.due).toHaveLength(1);
        expect(reports.error).toBeUndefined();
    });

    test("says so when it can't", async () => {
        const refused = new AuthorityReports({ authorityReports: async () => undefined });
        await refused.load();
        expect(refused.error).toBe("Failed to load the register (platform operators only)");
        expect(refused.loaded).toBe(false);

        const garbled = new AuthorityReports({ authorityReports: async () => "not json" });
        await garbled.load();
        expect(garbled.error).toBe("Failed to load the register");
    });
});
