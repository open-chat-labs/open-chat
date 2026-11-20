<!-- Create group (native plan 11, Design Notes §3.7), pushed from the Chats tab's menu and New
     chat: two steps on one screen, Back (the header's or Android's) going a step back.
     Members: a search by name or @username (the library's Field), the people picked as wrapping
     chips in place of "No one invited yet", a divider, then the people the user has DMs with
     (Suggested) or, searching, everyone found, as checkbox rows (details' InviteRow). Details:
     GeneralPage (photo, name, description, and the Settings card: Public group, Message history,
     Disappearing messages as the TimedToggle) with the card's links to Access gates, Rules and
     Permissions, the pages Manage has, pushed over this screen on the same draft
     (`new_group_settings`, newGroupDraft). The draft is the shared UpdateGroupState on the
     client's blank group, created through it as the old pages and the web's dialog create one,
     with the people picked invited; then the new group opens in this screen's place. Leaving
     with something entered asks first (TODO(design): the plan doesn't say). -->
<script lang="ts">
    import {
        allUsersStore,
        currentUserIdStore,
        directChatUsers,
        isDiamondStore,
        routeForChatIdentifier,
        serverDirectChatsStore,
        type OpenChat,
        type UserSummary,
    } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import Field from "@openchat/ui/src/lib/components/Field.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import UserChip from "@openchat/ui/src/lib/components/UserChip.svelte";
    import NativeAlert from "@openchat/ui/src/native/NativeAlert.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import SettingsLink from "@openchat/ui/src/native/SettingsLink.svelte";
    import { interpolateNewUi } from "@src/i18n/i18n";
    import { searchTerm } from "@src/logic/chats/chatSearch";
    import { TermSearch } from "@src/logic/chats/termSearch.svelte";
    import { senderColor } from "@src/logic/conversation/messageRow";
    import { UpdateGroupState } from "@src/logic/groupOrCommunity/group.svelte";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onDestroy, tick, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { aboveKeyboard } from "../../aboveKeyboard.svelte";
    import type { NativeScreen, NewGroupSettingsPage } from "../../router/locations";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenProps } from "../app/screens";
    import { manageRows } from "../details/details.adapter";
    import { chipName } from "../details/invite.adapter";
    import InviteRow from "../details/InviteRow.svelte";
    import GeneralPage from "./GeneralPage.svelte";
    import { holdNewGroup } from "./newGroupDraft";
    import {
        draftSavable,
        newGroupEntered,
        rulesProblem,
        rulesProblemKey,
        gatesSummary,
        invitable,
        permissionsSummary,
        rulesSummary,
    } from "./settings.adapter";

    let { context }: ScreenProps<Extract<NativeScreen, { kind: "new_group" }>> = $props();

    const client = getContext<OpenChat>("client");
    const t = (key: string, values?: Record<string, string | number>) => $_(key, { values });
    const overlays = untrack(() => context.overlays);

    // the draft: the client's blank group, held for the pages pushed over this screen
    const editor = new UpdateGroupState();
    editor.initialise(client.createCandidateGroup("group", false));
    onDestroy(holdNewGroup(editor));

    let step = $state<"members" | "details">("members");

    // ---- Members

    const me = $derived($currentUserIdStore);
    let query = $state("");
    const term = $derived(searchTerm(query));
    const people = new TermSearch((term) => client.searchUsers(term, 20));
    onDestroy(() => people.dispose());

    function onInput(next: string) {
        query = next;
        people.set(searchTerm(next));
    }

    const suggested = $derived(
        directChatUsers($serverDirectChatsStore, $allUsersStore).filter((u) => invitable(u, me)),
    );
    const found = $derived.by((): UserSummary[] => {
        const results = people.results;
        return results.kind === "found" && results.term === term
            ? results.found.filter((u) => invitable(u, me))
            : [];
    });
    const searching = $derived(term !== "" && people.results.kind === "searching");
    const shown = $derived(term === "" ? suggested : found);

    const picks = $derived(editor.candidateUsers);
    const picked = (userId: string) => picks.some((u) => u.userId === userId);

    function toggle(user: UserSummary) {
        if (picked(user.userId)) editor.deleteMember(user);
        else editor.addMember(user);
    }

    const displayName = (user: UserSummary) => user.displayName ?? user.username;

    // ---- Details: the Settings card's links to the pages Manage has, on this draft

    const links = $derived(
        manageRows(t).flatMap((row) =>
            row.page === "gates" || row.page === "rules" || row.page === "permissions"
                ? [{ ...row, page: row.page as NewGroupSettingsPage }]
                : [],
        ),
    );

    // why the rules can't be created, said on their row
    const rulesIssue = $derived(rulesProblem(editor.candidateGroup.rules));

    function linkValue(page: NewGroupSettingsPage): string {
        const group = editor.candidateGroup;
        switch (page) {
            case "gates":
                return gatesSummary(group.gateConfig, t);
            case "rules":
                return rulesSummary(group.rules.enabled, t);
            case "permissions":
                return permissionsSummary(group.permissions, t);
        }
    }

    async function create() {
        // the name as it's checked (draftSavable): trimmed
        const name = editor.candidateGroup.name.trim();
        if (name !== editor.candidateGroup.name) editor.candidateGroup.name = name;
        const outcome = await editor.saveGroup(client);
        switch (outcome.kind) {
            case "created_without_invites":
            case "created":
                if (outcome.kind === "created_without_invites") {
                    context.toast(interpolateNewUi($_, outcome.message));
                }
                // the new group is in the chat list by the next tick; it opens in this screen's
                // place (the URL is still the list's), under Chats whatever the list shows: a
                // new group isn't a favourite (nor in a community)
                await tick();
                navigate(routeForChatIdentifier("chats", outcome.chatId));
                return;
            case "failed":
                context.toast(interpolateNewUi($_, outcome.message));
                return;
            // not valid: why is under the field, or on the Rules row
            default:
                return;
        }
    }

    // ---- Back: a step back, and from the first, away (asking first with something entered)

    // anything picked or set: the people, or anything in the draft (newGroupEntered)
    const entered = $derived(
        newGroupEntered(editor.original, editor.candidateGroup, picks.length),
    );
    let discarding = $state(false);
    // Android's back is this screen's only while it's on top (not while one of its pages is
    // pushed over it, from the moment it is until the moment it's popped: context.onTop), and
    // stays used up while the group is being created (as the header's back is)
    useOverlay(
        overlays,
        () => context.onTop() && !discarding && (step === "details" || entered),
        () => back(),
        () => editor.busy,
    );
    useOverlay(
        overlays,
        () => discarding,
        () => (discarding = false),
    );

    function back() {
        if (editor.busy) return;
        if (step === "details") step = "members";
        else if (entered) discarding = true;
        else context.back?.();
    }
</script>

<div class="new-group">
    <NativePageHeader
        title={$_("newGroup")}
        sub={$_(
            step === "members"
                ? "native.groupSettings.create.membersStep"
                : "native.groupSettings.create.detailsStep",
        )}
        onBack={back} />

    {#if step === "members"}
        <div class="field">
            <Field
                placeholder={$_("native.invite.search")}
                value={query}
                onInput={(e) => onInput(e.currentTarget.value)}
                onClear={() => onInput("")}
                showShortcut={false} />
        </div>

        <div class="chips">
            {#each picks as user (user.userId)}
                <UserChip
                    label={chipName(displayName(user), user.username)}
                    photoUrl={user.blobUrl}
                    color={senderColor(user.userId)}
                    onRemove={() => toggle(user)} />
            {:else}
                <span class="placeholder">
                    <span class="placeholder-icon" aria-hidden="true"></span>
                    {$_("native.groupSettings.create.noneInvited")}
                </span>
            {/each}
        </div>

        <div class="list" {@attach aboveKeyboard()}>
            <span class="label">
                {$_(term === "" ? "native.invite.suggested" : "native.invite.results")}
                {#if searching}<Spinner size={12} />{/if}
            </span>
            {#each shown as user (user.userId)}
                <InviteRow
                    name={displayName(user)}
                    sub={`@${user.username}`}
                    photoUrl={user.blobUrl}
                    color={senderColor(user.userId)}
                    end={{ kind: "check", on: picked(user.userId), onToggle: () => toggle(user) }} />
            {:else}
                {#if !searching}
                    <span class="hint">
                        <span class="hint-icon" aria-hidden="true"></span>
                        {$_(
                            term === ""
                                ? "native.invite.searchHint"
                                : "native.groupSettings.create.noMatches",
                        )}
                    </span>
                {/if}
            {/each}
        </div>
    {:else}
        <div class="body" {@attach aboveKeyboard()}>
            <GeneralPage
                {editor}
                creating
                publicNeedsDiamond={!$isDiamondStore}
                readOnly={[]}
                color="violet"
                {context}>
                {#snippet settings()}
                    {#each links as link (link.page)}
                        <SettingsLink
                            icon={link.icon}
                            label={link.label}
                            value={linkValue(link.page)}
                            help={link.page === "rules" && rulesIssue !== undefined
                                ? $_(rulesProblemKey(rulesIssue))
                                : ""}
                            onClick={() => context.push({ kind: "new_group_settings", page: link.page })} />
                    {/each}
                {/snippet}
            </GeneralPage>
        </div>
    {/if}

    <div class="footer">
        {#if step === "members"}
            <Button
                label={$_("native.groupSettings.create.next")}
                size="lg"
                fullWidth
                onClick={() => (step = "details")} />
        {:else}
            <Button
                label={$_(
                    editor.busy
                        ? "native.groupSettings.create.creating"
                        : "native.groupSettings.create.create",
                )}
                size="lg"
                fullWidth
                disabled={!draftSavable(editor.candidateGroup, editor.valid) || editor.busy}
                onClick={() => void create()} />
        {/if}
    </div>
</div>

<NativeAlert
    open={discarding}
    title={$_("native.groupSettings.create.discardTitle")}
    message={$_("native.groupSettings.create.discardMessage")}
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

    .new-group {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .field {
        flex: none;
        padding: var(--space-4) var(--space-16) var(--space-10);
    }

    // the picks, wrapping, or the placeholder in their place; the divider under them
    .chips {
        flex: none;
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-6);
        min-height: 36px;
        max-height: 30%;
        overflow-y: auto;
        padding: 0 var(--space-16) var(--space-12);
        box-shadow: inset 0 -1px 0 var(--line-1);
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

    .label {
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
        display: flex;
        align-items: center;
        gap: var(--space-8);
        padding: var(--space-16) var(--space-4);
        font: var(--weight-regular) text-size(14px) / 1.5 var(--font-sans);
        color: var(--ink-4);
    }

    .hint-icon {
        @include icon(search, 16px, var(--ink-4));
    }

    .body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        padding-bottom: var(--space-24);
    }

    .footer {
        flex: none;
        padding: 12px var(--space-16) var(--bar-end);
    }
</style>
