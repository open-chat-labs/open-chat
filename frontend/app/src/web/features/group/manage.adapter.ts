import type { CommunitySummary, LeaveOrDelete, MultiUserChat } from "@client";
import type { ManageNavGroup as LibraryNavGroup } from "@openchat/ui/src/features/components/ManageDialog.svelte";
import type { ManageNavGroup, ManageNavLabel } from "@src/logic/groupOrCommunity/manage.svelte";
import type { GroupSettingsTab } from "../app/dialogs";

// Manage's nav, settings page and danger action from the app's, for ManageDialog.

const LABEL: Record<ManageNavLabel, string> = {
    overview: "ui.manageDialog.overview",
    about: "ui.manageDialog.about",
    members: "ui.manageDialog.members",
    invite: "ui.manageDialog.invite",
    channels: "ui.manageDialog.channels",
    userGroups: "ui.manageDialog.userGroups",
    rules: "ui.manageDialog.rules",
    permissions: "ui.manageDialog.permissions",
    gates: "ui.manageDialog.gates",
};

export function manageNavGroups(groups: ManageNavGroup[]): LibraryNavGroup[] {
    return groups
        .filter((g) => g.items.length > 0)
        .map((g) => ({
            label: `ui.manageDialog.${g.label}`,
            items: g.items.map((i) =>
                "section" in i
                    ? { key: i.section, label: LABEL[i.label], icon: i.section }
                    : { key: i.action, label: `ui.manageDialog.${i.action}`, icon: i.action },
            ),
        }));
}

/** The settings page GroupSettingsDialog shows for a Manage page of the form. */
export function settingsPage(section: string): GroupSettingsTab {
    return section === "gates" || section === "rules" || section === "permissions"
        ? section
        : "group";
}

/** Leaving or deleting this group, channel or community, for the confirm dialog. */
export function leaveOrDeleteFor(
    target: MultiUserChat | CommunitySummary,
    kind: "leave" | "delete",
): LeaveOrDelete {
    if (target.kind === "community") {
        return { kind: kind === "leave" ? "leave_community" : "delete_community", id: target.id };
    }
    return { kind, chatId: target.id };
}
