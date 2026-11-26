import {
    ADMIN_SECTIONS,
    adminSection,
    adminSectionPath,
    DEFAULT_ADMIN_SECTION,
    proposalsStatus,
    reportsStatus,
} from "./adminSections";

describe("the console's sections", () => {
    test("open on the default, Pending proposals, the first one", () => {
        expect(ADMIN_SECTIONS[0].id).toBe(DEFAULT_ADMIN_SECTION);
        expect(adminSection(undefined).id).toBe("proposals");
    });

    test("are found by their id, an unknown one being the default", () => {
        expect(adminSection("danger").label).toBe("Danger zone");
        expect(adminSection("nonsense").id).toBe("proposals");
    });

    test("each have their own id and path", () => {
        const ids = ADMIN_SECTIONS.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(adminSectionPath("vault")).toBe("/admin/vault");
    });
});

describe("the list panel's status lines", () => {
    test("proposals: the hint until loaded, then what awaits you and what's yours", () => {
        expect(proposalsStatus(undefined)).toEqual({
            sub: "Dual-authorised changes",
            subTone: "neutral",
        });
        expect(proposalsStatus({ awaitingYou: 0, yours: 0 }).sub).toBe(
            "Nothing awaiting confirmation",
        );
        expect(proposalsStatus({ awaitingYou: 2, yours: 1 })).toEqual({
            sub: "2 awaiting you · 1 yours",
            subTone: "warning",
            count: 2,
            countTone: "warning",
            countLabel: "2 awaiting your confirmation",
        });
        // your own proposals need someone else: no count
        expect(proposalsStatus({ awaitingYou: 0, yours: 1 })).toEqual({
            sub: "1 yours",
            subTone: "neutral",
        });
    });

    test("reports: overdue counted in red, due soon a warning, filed always said", () => {
        expect(reportsStatus(undefined).sub).toBe("NCA CSEA-IRP filings");
        expect(reportsStatus({ overdue: 1, soon: 1, filed: 5 })).toEqual({
            sub: "1 overdue · 1 due soon · 5 filed",
            subTone: "danger",
            count: 1,
            countTone: "danger",
            countLabel: "1 overdue",
        });
        expect(reportsStatus({ overdue: 0, soon: 2, filed: 0 })).toEqual({
            sub: "2 due soon · 0 filed",
            subTone: "warning",
        });
        expect(reportsStatus({ overdue: 0, soon: 0, filed: 3 })).toEqual({
            sub: "3 filed",
            subTone: "neutral",
        });
    });
});
