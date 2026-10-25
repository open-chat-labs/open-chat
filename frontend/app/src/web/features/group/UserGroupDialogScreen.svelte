<!-- Creating, editing or deleting a community's user group (UserGroupDialog). The client sends an
     edit's members added and removed (saveUserGroup); the dialog says a save or delete failed, and
     the app adds its own message (name taken, the member limit). -->
<script lang="ts">
    import {
        allUsersStore,
        selectedCommunityMembersStore,
        selectedCommunitySummaryStore,
        selectedCommunityUserGroupsStore,
        type OpenChat,
    } from "@client";
    import UserGroupDialog, {
        type UserGroupPerson,
    } from "@openchat/ui/src/features/components/UserGroupDialog.svelte";
    import { toastStore } from "@src/stores/toast";
    import { getContext, untrack } from "svelte";
    import type { DialogProps, LocalDialog } from "../app/dialogs";
    import { userGroupDialogGroup, userGroupPerson } from "./group.adapter";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "user_group" }>> = $props();

    const client = getContext<OpenChat>("client");

    const MAX_SEARCH_RESULTS = 255;

    const community = $derived(
        $selectedCommunitySummaryStore?.id.communityId === dialog.communityId.communityId
            ? $selectedCommunitySummaryStore
            : undefined,
    );
    // the group as it was opened: the dialog edits its own copy, and the save is worked out
    // against this
    const original = untrack(() =>
        dialog.userGroupId === undefined
            ? undefined
            : $selectedCommunityUserGroupsStore.get(dialog.userGroupId),
    );
    // named as their users load (the dialog takes its members' ids once, when it opens)
    const group = $derived(
        original === undefined ? null : userGroupDialogGroup(original, $allUsersStore),
    );
    const takenNames = $derived(
        [...$selectedCommunityUserGroupsStore.values()]
            .filter((g) => g.id !== original?.id)
            .map((g) => g.name),
    );
    const people = $derived(
        [...$selectedCommunityMembersStore.keys()].map((id) =>
            userGroupPerson(id, $allUsersStore.get(id)),
        ),
    );

    // a community that holds only some of its members searches for the rest, as the old editors did
    async function search(query: string): Promise<UserGroupPerson[]> {
        const found = await client.findMembers(dialog.communityId, query, MAX_SEARCH_RESULTS);
        return found.map((u) => userGroupPerson(u.userId, u));
    }

    // the dialog keeps the form and says it failed when these reject
    async function save(g: { title: string; memberIds: string[] }) {
        // a user group's name has no spaces, so its @mention is the name
        const name = g.title.replace(/\s+/g, "_");
        const outcome = await client.saveUserGroup(dialog.communityId, original, name, g.memberIds);
        if (outcome.kind === "failed") {
            toastStore.showFailureToast(outcome.message);
            throw new Error("not saved");
        }
    }

    async function remove() {
        if (original === undefined) return;
        if (!(await client.deleteUserGroup(dialog.communityId, original))) {
            throw new Error("not deleted");
        }
    }
</script>

{#if community !== undefined && (dialog.mode === "create" || group !== null)}
    <UserGroupDialog
        dialogMode={dialog.mode}
        communityName={community.name}
        {group}
        {people}
        onSearch={client.membersIncomplete(dialog.communityId) ? search : undefined}
        {takenNames}
        onSave={save}
        onDelete={remove}
        onCancel={onClose}
    />
{/if}
