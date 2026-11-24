<!-- A community's user group, made or changed (native plan 12's Manage → User groups: "members
     picked from the community"), pushed from its User groups page: its name (3 to 25 characters;
     spaces become underscores, as it's mentioned by it: logic/communities/userGroups, the old
     editors' rules), the people in it as chips ("No one in it yet" until there are), a search of
     the community's members (by name or @username; one that holds only some of its members finds
     the rest, client.findMembers, as the old editors did) and its members as checkbox rows, then
     the pinned Save (the client's saveUserGroup, which sends an edit's members added and removed)
     and, for one that's there, Delete, asked first in a small alert over the page (the client's
     deleteUserGroup). Leaving with changes asks first, as the settings pages do. Someone who may
     not manage user groups sees it read only. TODO(design): the plan has no layout for it. -->
<script lang="ts">
    import {
        allUsersStore,
        communitiesStore,
        knownMembers,
        memberMatchesSearch,
        selectedCommunityMembersStore,
        selectedCommunityUserGroupsStore,
        type OpenChat,
        type UserSummary,
    } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import Field from "@openchat/ui/src/lib/components/Field.svelte";
    import ListSectionLabel from "@openchat/ui/src/lib/components/ListSectionLabel.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import UserChip from "@openchat/ui/src/lib/components/UserChip.svelte";
    import NativeAlert from "@openchat/ui/src/native/NativeAlert.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import SettingsAction from "@openchat/ui/src/native/SettingsAction.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import { interpolateNewUi } from "@src/i18n/i18n";
    import { searchTerm } from "@src/logic/chats/chatSearch";
    import { TermSearch } from "@src/logic/chats/termSearch.svelte";
    import {
        USER_GROUP_NAME_MAX,
        USER_GROUP_NAME_MIN,
        userGroupChanged,
        userGroupName,
        userGroupProblem,
    } from "@src/logic/communities/userGroups";
    import { senderColor } from "@src/logic/conversation/messageRow";
    import { getContext, onDestroy, onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { SvelteSet } from "svelte/reactivity";
    import { aboveKeyboard } from "../../aboveKeyboard.svelte";
    import type { NativeScreen } from "../../router/locations";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenProps } from "../app/screens";
    import { chipName } from "../details/invite.adapter";
    import InviteRow from "../details/InviteRow.svelte";
    import { userGroupPeople } from "./communitySettings.adapter";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "user_group" }>> =
        $props();

    const client = getContext<OpenChat>("client");
    const overlays = untrack(() => context.overlays);
    const communityId = untrack(() => screen.communityId);
    const community = $derived($communitiesStore.get(communityId));
    const editable = $derived(client.canManageUserGroups(communityId));

    // the group as it was opened: the page edits its own copy, and the save is worked out against
    // it (the store's member set is never changed here)
    const original = untrack(() =>
        screen.userGroupId === undefined
            ? undefined
            : $selectedCommunityUserGroupsStore.get(screen.userGroupId),
    );
    let name = $state(original?.name ?? "");
    const picked = new SvelteSet<string>(original?.members ?? []);

    // a community that holds only some of its members may not hold the group's
    onMount(() => {
        if (original !== undefined) void client.loadUserGroupMembers(communityId, original.id);
    });

    const taken = $derived(
        [...$selectedCommunityUserGroupsStore.values()]
            .filter((g) => g.id !== original?.id)
            .map((g) => g.name),
    );
    const problem = $derived(userGroupProblem(name, picked.size, taken));
    const changed = $derived(userGroupChanged(original, name, picked));
    let busy = $state(false);
    const canSave = $derived(editable && changed && problem === undefined && !busy);

    // ---- the people: the community's members it holds, and those found for a search

    let query = $state("");
    const term = $derived(searchTerm(query));
    const finder = new TermSearch((term) =>
        client.membersIncomplete(communityId)
            ? client.findMembers(communityId, term, 255)
            : Promise.resolve([]),
    );
    onDestroy(() => finder.dispose());

    function onInput(next: string) {
        query = next;
        finder.set(searchTerm(next));
    }

    const members = $derived(knownMembers($allUsersStore, $selectedCommunityMembersStore.values()));
    const shown = $derived(
        userGroupPeople(members, (m) => memberMatchesSearch(term.toLowerCase(), m)),
    );
    const searching = $derived(term !== "" && finder.results.kind === "searching");
    const chips = $derived(
        [...picked].flatMap((id) => {
            const user = $allUsersStore.get(id);
            return user === undefined ? [] : [user];
        }),
    );

    function toggle(userId: string) {
        if (!editable) return;
        if (picked.has(userId)) picked.delete(userId);
        else picked.add(userId);
    }

    const displayName = (user: UserSummary) => user.displayName ?? user.username;

    // ---- saving and deleting

    async function save() {
        if (!canSave) return;
        busy = true;
        try {
            const outcome = await client.saveUserGroup(
                communityId,
                original,
                userGroupName(name),
                [...picked],
            );
            if (outcome.kind === "failed") {
                context.toast(interpolateNewUi($_, outcome.message));
                return;
            }
            context.toast($_("native.groupSettings.saved"));
            context.back?.();
        } finally {
            busy = false;
        }
    }

    let deleting = $state(false);
    useOverlay(
        overlays,
        () => deleting,
        () => (deleting = false),
    );

    async function remove() {
        if (original === undefined) return;
        busy = true;
        try {
            if (await client.deleteUserGroup(communityId, original)) {
                deleting = false;
                context.toast(
                    $_("native.communitySettings.userGroups.deleted", {
                        values: { name: `@${original.name}` },
                    }),
                );
                context.back?.();
            } else {
                deleting = false;
                context.toast($_("communities.errors.deleteUserGroupFailed"));
            }
        } finally {
            busy = false;
        }
    }

    // ---- leaving with changes asks first, from the header's Back and Android's

    let discarding = $state(false);
    useOverlay(
        overlays,
        () => editable && changed && !discarding && !deleting && !busy,
        () => (discarding = true),
    );
    useOverlay(
        overlays,
        () => discarding,
        () => (discarding = false),
    );

    function back() {
        if (editable && changed && !busy) discarding = true;
        else context.back?.();
    }

    const note = $derived(
        problem === "name_length" && name.trim() !== ""
            ? $_("native.groupSettings.nameRules", {
                  values: { min: USER_GROUP_NAME_MIN, max: USER_GROUP_NAME_MAX },
              })
            : problem === "name_taken"
              ? $_("native.communitySettings.userGroups.nameTaken")
              : userGroupName(name) !== ""
                ? $_("native.communitySettings.userGroups.mention", {
                      values: { mention: `@${userGroupName(name)}` },
                  })
                : $_("native.communitySettings.userGroups.nameHint"),
    );
</script>

<div class="user-group">
    <NativePageHeader
        title={$_(
            original === undefined
                ? "native.communitySettings.userGroups.new"
                : "native.communitySettings.userGroups.edit",
        )}
        sub={community?.name ?? ""}
        onBack={back} />

    <div class="top">
        <div class="label"><ListSectionLabel label={$_("native.groupSettings.name")} /></div>
        <label class="name" class:warn={problem === "name_taken" || (problem === "name_length" && name.trim() !== "")}>
            <span class="at" aria-hidden="true">@</span>
            <input
                value={name}
                oninput={(e) => (name = e.currentTarget.value)}
                placeholder={$_("native.communitySettings.userGroups.namePlaceholder")}
                aria-label={$_("native.groupSettings.name")}
                disabled={!editable || busy}
                maxlength={USER_GROUP_NAME_MAX + 10}
                autocomplete="off"
                autocapitalize="off"
                enterkeyhint="next" />
        </label>
        <span class="note" class:warn={problem === "name_taken"}>{note}</span>
    </div>

    <div class="chips">
        {#each chips as user (user.userId)}
            <UserChip
                label={chipName(displayName(user), user.username)}
                photoUrl={user.blobUrl}
                color={senderColor(user.userId)}
                showRemove={editable}
                onRemove={() => toggle(user.userId)} />
        {:else}
            <span class="placeholder">
                <span class="placeholder-icon" aria-hidden="true"></span>
                {$_("native.communitySettings.userGroups.noMembers")}
            </span>
        {/each}
    </div>

    {#if editable}
        <div class="field">
            <Field
                placeholder={$_("native.communitySettings.userGroups.search")}
                value={query}
                onInput={(e) => onInput(e.currentTarget.value)}
                onClear={() => onInput("")}
                showShortcut={false} />
        </div>
    {/if}

    <div class="list" {@attach aboveKeyboard()}>
        {#if editable}
            <span class="list-label">
                {$_("native.communitySettings.userGroups.people")}
                {#if searching}<Spinner size={12} />{/if}
            </span>
            {#each shown as user (user.userId)}
                <InviteRow
                    name={displayName(user)}
                    sub={`@${user.username}`}
                    photoUrl={user.blobUrl}
                    color={senderColor(user.userId)}
                    end={{
                        kind: "check",
                        on: picked.has(user.userId),
                        onToggle: () => toggle(user.userId),
                    }} />
            {:else}
                {#if !searching}
                    <span class="hint">{$_("native.groupSettings.create.noMatches")}</span>
                {/if}
            {/each}
        {/if}

        {#if editable && original !== undefined}
            <div class="danger">
                <SettingsGroup>
                    <SettingsAction
                        icon="trash"
                        label={$_("native.communitySettings.userGroups.delete")}
                        danger
                        onClick={() => {
                            if (!busy) deleting = true;
                        }} />
                </SettingsGroup>
            </div>
        {/if}
    </div>

    {#if editable}
        <div class="footer">
            <Button
                label={$_(
                    busy
                        ? "native.groupSettings.saving"
                        : original === undefined
                          ? "native.communitySettings.userGroups.create"
                          : changed
                            ? "native.groupSettings.save"
                            : "native.groupSettings.noChanges",
                )}
                size="lg"
                fullWidth
                disabled={!canSave}
                onClick={() => void save()} />
        </div>
    {/if}
</div>

<!-- a small confirm, over the page (the project's rule for Delete) -->
<NativeAlert
    open={deleting}
    title={$_("native.communitySettings.userGroups.deleteTitle")}
    message={$_("native.communitySettings.userGroups.deleteMessage", {
        values: { name: `@${original?.name ?? ""}` },
    })}
    confirmLabel={$_("native.communitySettings.userGroups.confirmDelete")}
    cancelLabel={$_("cancel")}
    danger
    {busy}
    onConfirm={() => void remove()}
    onClose={() => (deleting = false)} />

<NativeAlert
    open={discarding}
    title={$_("native.groupSettings.discardTitle")}
    message={$_("native.groupSettings.discardMessage")}
    confirmLabel={$_("native.groupSettings.discard")}
    cancelLabel={$_("native.groupSettings.keepEditing")}
    danger
    onConfirm={() => {
        discarding = false;
        context.back?.();
    }}
    onClose={() => (discarding = false)} />

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .user-group {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .top {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px var(--space-16) 14px;
    }

    .label {
        padding-inline-start: 4px;
    }

    .name {
        display: flex;
        align-items: center;
        gap: 2px;
        height: 52px;
        padding: 0 var(--space-16);
        border-radius: 14px;
        background: var(--overlay-1);

        &.warn {
            box-shadow: inset 0 0 0 1.5px var(--status-warning);
        }

        &:focus-within:not(.warn) {
            box-shadow: inset 0 0 0 1.5px var(--accent);
        }
    }

    .at {
        font: var(--weight-semibold) text-size(16px) / 1 var(--font-sans);
        color: var(--ink-4);
    }

    input {
        flex: 1;
        min-width: 0;
        height: 100%;
        padding: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--ink);
        font: var(--weight-semibold) text-size(16px) / 1 var(--font-sans);

        &::placeholder {
            color: var(--ink-4);
        }
    }

    .note {
        padding: 0 4px;
        font: var(--weight-medium) text-size(12.5px) / 1.35 var(--font-sans);
        color: var(--ink-4);

        &.warn {
            color: var(--status-warning);
        }
    }

    // the people in it, wrapping, or the placeholder in their place
    .chips {
        flex: none;
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-6);
        min-height: 36px;
        max-height: 20%;
        overflow-y: auto;
        padding: 0 var(--space-16) var(--space-10);
    }

    .placeholder {
        display: flex;
        align-items: center;
        gap: var(--space-8);
        min-height: 36px;
        font: var(--weight-medium) text-size(14px) / 1.3 var(--font-sans);
        color: var(--ink-4);
    }

    .placeholder-icon {
        @include icon(users, 16px, var(--ink-4));
    }

    .field {
        flex: none;
        padding: var(--space-4) var(--space-16) var(--space-10);
        box-shadow: inset 0 -1px 0 var(--line-1);
    }

    .list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        padding: 14px var(--space-16) var(--space-24);
    }

    .list-label {
        display: flex;
        align-items: center;
        gap: var(--space-8);
        padding: var(--space-8) var(--space-4) var(--space-2);
        font: var(--weight-semibold) text-size(12px) / 1.2 var(--font-sans);
        color: var(--ink-4);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .hint {
        padding: var(--space-16) var(--space-4);
        font: var(--weight-regular) text-size(14px) / 1.5 var(--font-sans);
        color: var(--ink-4);
    }

    .danger {
        margin-top: 18px;
    }

    .footer {
        flex: none;
        padding: 12px var(--space-16) var(--bar-end);
    }
</style>
