import type { ManageAccess } from "./detailsPermissions";

// The Manage dialog's pages and the move between them: one per group, channel or community, with a
// nav down the side. Overview (or About), Gates, Rules and Permissions are one settings form, so
// moving between them keeps its draft; any other move with unsaved edits asks first.

export type ManageSection = "main" | "gates" | "rules" | "permissions" | "invite";

const FORM: readonly ManageSection[] = ["main", "gates", "rules", "permissions"];

export function isFormSection(section: ManageSection): boolean {
    return FORM.includes(section);
}

export type ManageNavItem = { section: ManageSection; label: ManageNavLabel };
export type ManageNavLabel = "overview" | "about" | "invite" | "rules" | "permissions" | "gates";
export type ManageNavGroup = { label: "general" | "advanced"; items: ManageNavItem[] };

export type ManageNavInput = {
    access: ManageAccess;
    canOpenInvite: boolean;
};

/**
 * The pages offered, grouped as the design has them: everyday running (General) and setup most
 * people rarely touch (Advanced). Someone who can't edit gets the About page, and the rules and
 * gates read-only; permissions are only for someone who can edit.
 */
export function manageNav({ access, canOpenInvite }: ManageNavInput): ManageNavGroup[] {
    const edit = access.kind === "edit";
    const general: ManageNavItem[] = [
        { section: "main", label: edit ? "overview" : "about" },
        ...(canOpenInvite ? [{ section: "invite" as const, label: "invite" as const }] : []),
        { section: "rules", label: "rules" },
    ];
    const advanced: ManageNavItem[] = [
        ...(edit ? [{ section: "permissions" as const, label: "permissions" as const }] : []),
        { section: "gates", label: "gates" },
    ];
    return [
        { label: "general", items: general },
        { label: "advanced", items: advanced },
    ];
}

/** The footer's one danger action: the owner deletes (they can't leave), anyone else leaves. */
export function manageDanger(
    canDelete: boolean,
    canLeave: boolean,
): "delete" | "leave" | undefined {
    return canDelete ? "delete" : canLeave ? "leave" : undefined;
}

/**
 * The open page, and the "Discard changes?" step (4b invariant 8): leaving the settings form
 * (closing Manage, or opening a page outside it) with unsaved edits asks first, and so does
 * leaving Invite with people picked; moving between the form's pages keeps the draft.
 */
export class ManageState {
    #section = $state<ManageSection>("main");
    #dirty = $state(false);
    #pending = $state<(() => void) | undefined>();

    constructor(section: ManageSection) {
        this.#section = section;
    }

    get section(): ManageSection {
        return this.#section;
    }

    /** Whether "Discard changes?" is showing. */
    get confirming(): boolean {
        return this.#pending !== undefined;
    }

    /** The open page reports whether it has unsaved edits. */
    setDirty(dirty: boolean) {
        this.#dirty = dirty;
    }

    go(section: ManageSection) {
        if (section === this.#section) return;
        if (isFormSection(section) && isFormSection(this.#section)) {
            this.#section = section;
            return;
        }
        this.#guard(() => {
            this.#section = section;
            this.#dirty = false;
        });
    }

    close(onClose: () => void) {
        this.#guard(onClose);
    }

    keepEditing() {
        this.#pending = undefined;
    }

    discard() {
        const next = this.#pending;
        this.#pending = undefined;
        this.#dirty = false;
        next?.();
    }

    #guard(next: () => void) {
        if (this.#dirty) this.#pending = next;
        else next();
    }
}
