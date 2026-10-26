import { describe, expect, test, vi } from "vitest";
import { manageDanger, manageNav, ManageState } from "./manage.svelte";

describe("moving around Manage", () => {
    // 4b invariant 8: moving between Overview, Gates, Rules and Permissions keeps the draft
    test("moves between the settings form's pages without asking", () => {
        const manage = new ManageState("main");
        manage.setDirty(true);

        manage.go("gates");
        manage.go("permissions");

        expect(manage.section).toBe("permissions");
        expect(manage.confirming).toBe(false);
    });

    // 4b invariant 8: leaving the form, or closing, with unsaved edits asks before discarding
    test("asks before leaving the form or closing with unsaved edits", () => {
        const manage = new ManageState("rules");
        const onClose = vi.fn();
        manage.setDirty(true);

        manage.go("invite");
        expect(manage.section).toBe("rules");
        expect(manage.confirming).toBe(true);
        manage.keepEditing();
        expect(manage.section).toBe("rules");

        manage.close(onClose);
        expect(onClose).not.toHaveBeenCalled();
        manage.discard();
        expect(onClose).toHaveBeenCalledOnce();
    });

    test("discarding goes where it was asked to, and a clean form doesn't ask", () => {
        const manage = new ManageState("main");
        manage.setDirty(true);
        manage.go("invite");
        manage.discard();
        expect(manage.section).toBe("invite");

        // nothing picked on Invite: back to the form straight away
        manage.go("main");
        expect(manage.section).toBe("main");
        expect(manage.confirming).toBe(false);
    });
});

describe("Manage's pages", () => {
    const sections = (input: Parameters<typeof manageNav>[0]) =>
        manageNav(input).flatMap((g) =>
            g.items.map((i) => ("section" in i ? `${i.section}:${i.label}` : `action:${i.action}`)),
        );

    // 4b invariant 7 in the nav: someone who can't edit gets About, and no Permissions
    test("someone who can't edit gets About and no Permissions", () => {
        expect(
            sections({
                access: { kind: "about" },
                canOpenInvite: false,
                community: false,
                canManageUserGroups: false,
                canConvert: false,
                canImport: false,
            }),
        ).toEqual(["main:about", "members:members", "rules:rules", "gates:gates"]);
        expect(
            sections({
                access: { kind: "edit", readOnly: [] },
                canOpenInvite: true,
                community: true,
                canManageUserGroups: true,
                canConvert: true,
                canImport: true,
            }),
        ).toEqual([
            "main:overview",
            "members:members",
            "invite:invite",
            "channels:channels",
            "usergroups:userGroups",
            "rules:rules",
            "permissions:permissions",
            "gates:gates",
            "action:convert",
            "action:import",
        ]);
    });

    test("convert and import each follow their own permission", () => {
        const base = {
            access: { kind: "edit" as const, readOnly: [] },
            canOpenInvite: false,
            community: false,
            canManageUserGroups: false,
        };
        expect(sections({ ...base, canConvert: true, canImport: false })).toContain(
            "action:convert",
        );
        expect(sections({ ...base, canConvert: true, canImport: false })).not.toContain(
            "action:import",
        );
        expect(sections({ ...base, canConvert: false, canImport: true })).toEqual(
            expect.arrayContaining(["action:import"]),
        );
    });

    test("the owner deletes, anyone else who can leaves", () => {
        expect(manageDanger(true, false)).toBe("delete");
        expect(manageDanger(false, true)).toBe("leave");
        expect(manageDanger(false, false)).toBeUndefined();
    });
});
