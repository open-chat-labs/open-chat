<!-- A group's or channel's members (native plan 10, Design Notes §3.6), pushed from its details.
     Owners, admins and moderators get tabs (@client's memberTabs): Members | Lapsed | Blocked where
     the group or its community has access gates, Members | Blocked where it hasn't; a regular member
     sees the members only. It always opens on Members, and switching tabs clears the search (the
     library's Field, with its clear ×, as Invite people's), whose placeholder follows the tab.
     Members: the search (a large group holds only its first page of members, so it finds the others
     as the web's panel does), Invite people for someone who may invite, then the members in role
     sections (Owners, Admins, Moderators, Members). The ⋯ on a member below you offers the roles up
     to your own where your role meets "Change member roles", and Remove and Block where it meets
     "Remove / block members" (@client's memberMenu); Block only in a public group, as the backend
     blocks in no other (a channel's blocking is its community's); with neither, it says so in a
     toast. Lapsed: their ⋯ removes them from the group; Blocked: theirs
     unblocks them; both under "Remove / block members" (listedUserMenu). Removing, blocking and
     unblocking wait out their Undo before they're sent (a block takes them out of the group, which
     unblocking can't undo); unblocking says they can join again. Tapping someone opens their
     profile sheet. The operations are the web panel's (logic/members/MemberManagement). -->
<script lang="ts">
    import {
        allUsersStore,
        anonUserStore,
        chatIdentifiersEqual,
        chatIdentifierToString,
        chatListScopeStore,
        chatSummariesListStore,
        currentUserIdStore,
        hasAccessGates,
        knownMembers,
        listedUserMenu,
        memberHasMenu,
        memberMatchesSearch,
        memberMenu,
        memberSections,
        memberTabs,
        ROLE_NONE,
        selectedChatSummaryStore,
        selectedCommunitySummaryStore,
        usersFromIds,
        blockOutcome,
        type BlockContext,
        type MemberRole,
        type MemberTab,
        type MultiUserChat,
        type OpenChat,
        type ToastOutcome,
        type UserSummary,
    } from "@client";
    import Field from "@openchat/ui/src/lib/components/Field.svelte";
    import SegmentedTabs from "@openchat/ui/src/lib/components/SegmentedTabs.svelte";
    import AnchoredMenu from "@openchat/ui/src/native/AnchoredMenu.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import type { NativeMenuItem } from "@openchat/ui/src/native/types";
    import { i18nKey, interpolate } from "@src/i18n/i18n";
    import { chatWithRoute } from "@src/logic/appEvents/appEvents";
    import { senderColor } from "@src/logic/conversation/messageRow";
    import { chatInviteAccess } from "@src/logic/members/invitePeople";
    import { MemberManagement } from "@src/logic/members/memberManagement.svelte";
    import { toastStore } from "@src/stores/toast";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onDestroy, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { NativeScreen } from "../../router/locations";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenProps } from "../app/screens";
    import { sendAfterUndo } from "../chats/removeWithUndo";
    import { HeldWhileLeaving } from "../conversation/heldWhileLeaving";
    import { memberMenuItems, menuItemRole, roleWord } from "./details.adapter";
    import MemberListRow from "./MemberListRow.svelte";
    import { keptTab, MEMBER_TAB_LABELS, MEMBER_TAB_SEARCH, memberTabCounts } from "./members.adapter";
    import { openInvite } from "./openInvite";
    import ProfileSheet, { type ProfilePerson } from "./ProfileSheet.svelte";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "chat_members" }>> =
        $props();

    const client = getContext<OpenChat>("client");
    const overlays = untrack(() => context.overlays);

    const t = (key: string, values?: Record<string, string | number>) => $_(key, { values });

    // the chat is the selected one (the details' and the conversation's), held while it slides out
    const selected = $derived(
        $selectedChatSummaryStore !== undefined &&
            chatIdentifiersEqual($selectedChatSummaryStore.id, screen.chatId),
    );
    const held = new HeldWhileLeaving<MultiUserChat | undefined>(undefined);
    const chat = $derived(
        held.of(
            selected,
            $selectedChatSummaryStore?.kind === "direct_chat" ? undefined : $selectedChatSummaryStore,
        ),
    );
    const chatKey = $derived(chat === undefined ? "" : chatIdentifierToString(chat.id));
    // the members' operations, one for the chat (not one per change to its summary)
    const management = $derived.by(() => {
        void chatKey;
        return untrack(() => (chat === undefined ? undefined : new MemberManagement(client, chat)));
    });

    const me = $derived($currentUserIdStore);
    const myRole = $derived<MemberRole>(chat?.membership.role ?? ROLE_NONE);
    const community = $derived(
        chat?.kind === "channel" ? $selectedCommunitySummaryStore : undefined,
    );

    // one being removed, blocked or unblocked is gone from its list while its Undo shows
    const removalKey = (userId: string) => `member:${chatKey}:${userId}`;
    const shown = (users: UserSummary[]) =>
        users.filter((u) => !context.removals.has(removalKey(u.userId)));

    // ---- the tabs: Members, then Lapsed (with gates) and Blocked, for owners, admins and
    // moderators; it opens on Members, and a tab that goes (the gates taken away, a role lost)
    // goes back to it, for good: it doesn't come back by itself if the tab does (keptTab)

    const lapsedAll = $derived(
        management === undefined ? [] : shown(usersFromIds($allUsersStore, management.lapsed)),
    );
    const blockedAll = $derived(
        management === undefined ? [] : shown(usersFromIds($allUsersStore, management.blocked)),
    );
    const tabs = $derived<MemberTab[]>(
        chat === undefined
            ? []
            : memberTabs(myRole, hasAccessGates(chat.gateConfig, community?.gateConfig)),
    );
    let chosen = $state<MemberTab>("members");
    const tab = $derived<MemberTab>(keptTab(chosen, tabs));
    // the chosen tab gone: back on Members, with the search cleared, as choosing it would
    $effect.pre(() => {
        if (tab !== chosen) untrack(() => showTab(tab));
    });

    function selectTab(index: number) {
        const next = tabs[index];
        if (next === undefined || next === tab) return;
        showTab(next);
    }

    function showTab(next: MemberTab) {
        chosen = next;
        onInput("");
    }

    // Invite people, on the Members tab, for someone it opens for
    const canOpenInvite = $derived(
        chat !== undefined &&
            chatInviteAccess(client, chat, community, $anonUserStore).kind === "allowed",
    );

    // ---- the search: what's held is filtered at once, and (members) the others are looked for

    let query = $state("");
    const term = $derived(query.trim().toLowerCase());
    let cancelFind: (() => void) | undefined;
    onDestroy(() => cancelFind?.());

    function onInput(value: string) {
        query = value;
        cancelFind?.();
        cancelFind = tab === "members" ? management?.findMembers(value.trim()) : undefined;
    }

    // ---- the members, by role

    type Row = {
        userId: string;
        role: MemberRole;
        name: string;
        username: string;
        photoUrl: string | undefined;
        isMe: boolean;
    };

    const rows = $derived.by((): Row[] => {
        if (management === undefined) return [];
        return knownMembers($allUsersStore, management.members.values())
            .filter((m) => !context.removals.has(removalKey(m.userId)))
            .filter((m) => memberMatchesSearch(term, m))
            .map((m) => ({
                userId: m.userId,
                role: m.role,
                name: m.displayName ?? m.username,
                username: m.username,
                photoUrl: m.blobUrl,
                isMe: m.userId === me,
            }));
    });
    const sections = $derived(memberSections(rows, me));

    // the lapsed or the blocked, on their tab
    const listed = $derived(
        tab === "lapsed"
            ? lapsedAll.filter((u) => memberMatchesSearch(term, u))
            : tab === "blocked"
              ? blockedAll.filter((u) => memberMatchesSearch(term, u))
              : [],
    );

    const SECTION_LABELS = {
        owners: "native.details.members.owners",
        admins: "native.details.members.admins",
        moderators: "native.details.members.moderators",
        members: "native.details.members.members",
    } as const;

    // ---- a member's ⋯: a row shows one from the roles alone (memberHasMenu), and what it offers,
    // from the permissions, is worked out as it opens, not for every row on every render

    type Target = { userId: string; name: string; role: MemberRole };

    let menuAnchor = $state<HTMLElement | null>(null);
    let menuItems = $state<NativeMenuItem[]>([]);
    // who the open menu is for: kept past its close, which comes just before the pick
    let target: Target | undefined;
    useOverlay(
        overlays,
        () => menuAnchor !== null,
        () => (menuAnchor = null),
    );

    function openMenu(row: Row, anchor: HTMLElement) {
        if (management === undefined) return;
        const menu = memberMenu(
            myRole,
            { role: row.role, isMe: row.isMe },
            management.actionsFor(row.role, row.isMe),
        );
        if (menu.kind === "not_allowed") {
            context.toast(t("native.details.members.notAllowed"));
            return;
        }
        if (menu.kind !== "actions") return;
        target = { userId: row.userId, name: row.name, role: row.role };
        menuItems = memberMenuItems(menu, t);
        menuAnchor = anchor;
    }

    // a lapsed member's ⋯ (Remove from the group) or a blocked user's (Unblock)
    function openListedMenu(
        on: Exclude<MemberTab, "members">,
        userId: string,
        name: string,
        anchor: HTMLElement,
    ) {
        if (management === undefined || chat === undefined) return;
        const menu = listedUserMenu(on, {
            canRemove: management.canRemoveMembers(),
            canUnblock: management.canUnblockUsers(),
        });
        if (menu.kind === "not_allowed") {
            context.toast(
                t(
                    on === "lapsed"
                        ? "native.details.members.lapsedNotAllowed"
                        : "native.details.members.blockedNotAllowed",
                ),
            );
            return;
        }
        target = { userId, name, role: ROLE_NONE };
        menuItems =
            menu.action === "remove"
                ? [
                      {
                          id: "remove",
                          label: interpolate(
                              $_,
                              i18nKey("native.details.members.removeFrom", undefined, chat.level, true),
                          ),
                          icon: "user-minus",
                          danger: true,
                      },
                  ]
                : [{ id: "unblock", label: t("native.details.members.unblock"), icon: "ban" }];
        menuAnchor = anchor;
    }

    function onPick(id: string) {
        const who = target;
        const members = management;
        if (who === undefined || members === undefined) return;
        const role = menuItemRole(id);
        if (role !== undefined) {
            void changeRole(members, who, role);
        } else if (id === "remove") {
            sendAfterUndo(
                context,
                removalKey(who.userId),
                t("native.details.members.removed", { name: who.name }),
                async () => toastStore.showOutcome(await members.removeMember(who.userId)),
            );
        } else if (id === "block") {
            // a refusal says so; it's done, the Undo toast has said so already
            blockLater(who.userId, who.name, async () => {
                const outcome = await members.blockUser(who.userId);
                if (outcome.kind === "failed") toastStore.showOutcome(outcome);
            });
        } else if (id === "unblock") {
            unblockLater(who.userId, who.name, () => members.unblockUser(who.userId));
        }
    }

    // A block takes them out of the group, and unblocking only lifts the ban (the backend can't
    // add them back: they join again themselves), so it isn't sent until its Undo has gone (the
    // shell's PendingRemovals, as a removal), and Undo leaves them as they were. Meanwhile they're
    // gone from the list; once it's in, they're under Blocked.
    function blockLater(userId: string, name: string, commit: () => Promise<void>) {
        sendAfterUndo(
            context,
            removalKey(userId),
            t("native.conversation.toast.blocked", { name }),
            commit,
        );
    }

    // An unblock (the Blocked tab's ⋯ or the profile sheet's), with Undo, as a removal: they're
    // gone from Blocked meanwhile, it's sent once the toast has gone, and Undo sends nothing
    function unblockLater(userId: string, name: string, unblock: () => Promise<ToastOutcome>) {
        sendAfterUndo(
            context,
            removalKey(userId),
            t("native.details.members.unblockedRejoin", { name }),
            async () => {
                const outcome = await unblock();
                if (outcome.kind === "failed") toastStore.showOutcome(outcome);
            },
        );
    }

    async function changeRole(members: MemberManagement, who: Target, role: MemberRole) {
        const outcome = await members.changeRole(
            { userId: who.userId, newRole: role, oldRole: who.role },
            $_,
        );
        if (outcome.kind === "success") {
            context.toast(t(`native.details.members.now.${roleWord(role)}`, { name: who.name }));
        } else {
            toastStore.showOutcome(outcome);
        }
    }

    // ---- someone's profile sheet

    let profile = $state<ProfilePerson>();
    useOverlay(
        overlays,
        () => profile !== undefined,
        () => (profile = undefined),
    );

    function message(userId: string) {
        profile = undefined;
        navigate(
            chatWithRoute({ kind: "direct_chat", userId }, $chatSummariesListStore, $chatListScopeStore),
        );
    }

    // the sheet's Block and Unblock, where it was opened (the group, or a channel's community), as
    // the ⋯'s
    function blockFromSheet(person: ProfilePerson, blocking: boolean, where: BlockContext) {
        profile = undefined;
        const outcome = async (done: Promise<boolean>) => blockOutcome(blocking, await done);
        if (blocking) {
            blockLater(person.userId, person.name, async () => {
                const result = await outcome(client.blockUserInContext(where, person.userId));
                if (result.kind === "failed") toastStore.showOutcome(result);
            });
        } else {
            unblockLater(person.userId, person.name, () =>
                outcome(client.unblockUserInContext(where, person.userId)),
            );
        }
    }
</script>

<div class="members">
    <NativePageHeader title={$_("members")} onBack={context.back} />

    {#if tabs.length > 0}
        <div class="tabs">
            <SegmentedTabs
                size="sm"
                labels={tabs.map((id) => $_(MEMBER_TAB_LABELS[id]))}
                counts={memberTabCounts(tabs, lapsedAll.length)}
                selectedIndex={tabs.indexOf(tab)}
                dotIndexes={[]}
                onSelect={selectTab} />
        </div>
    {/if}

    <div class="field">
        <Field
            placeholder={$_(MEMBER_TAB_SEARCH[tab])}
            value={query}
            onInput={(e) => onInput(e.currentTarget.value)}
            onClear={() => onInput("")}
            showShortcut={false} />
    </div>

    <div class="list">
        {#if tab === "lapsed" || tab === "blocked"}
            {@const on = tab}
            <p class="note">
                {interpolate(
                    $_,
                    i18nKey(`native.details.members.${on}Note`, undefined, chat?.level, true),
                )}
            </p>
            {#each listed as user (user.userId)}
                {@const name = user.displayName ?? user.username}
                {@const isMe = user.userId === me}
                <MemberListRow
                    {name}
                    username={user.username}
                    photoUrl={user.blobUrl}
                    color={senderColor(user.userId)}
                    {isMe}
                    onOpen={() => (profile = { userId: user.userId, name, isMe })}
                    onMore={isMe
                        ? undefined
                        : (anchor) => openListedMenu(on, user.userId, name, anchor)}
                    moreLabel={t("native.chats.rowOptions", { name })} />
            {:else}
                <span class="none">
                    {$_(
                        term !== ""
                            ? "native.details.members.noOneMatches"
                            : `native.details.members.${on}Empty`,
                    )}
                </span>
            {/each}
        {:else}
            {#if canOpenInvite && chat !== undefined}
                {@const invitingTo = chat}
                <button
                    type="button"
                    class="invite"
                    onclick={() =>
                        openInvite(client, invitingTo, community, $anonUserStore, context, $_)}>
                    <span class="invite-icon" aria-hidden="true"></span>
                    <span class="invite-label">{$_("native.invite.title")}</span>
                </button>
            {/if}

            {#each sections as section (section.id)}
                <span class="label">
                    {t(SECTION_LABELS[section.id], { count: section.members.length })}
                </span>
                {#each section.members as row (row.userId)}
                    <MemberListRow
                        name={row.name}
                        username={row.username}
                        photoUrl={row.photoUrl}
                        color={senderColor(row.userId)}
                        isMe={row.isMe}
                        onOpen={() =>
                            (profile = { userId: row.userId, name: row.name, isMe: row.isMe })}
                        onMore={management === undefined || !memberHasMenu(myRole, row)
                            ? undefined
                            : (anchor) => openMenu(row, anchor)}
                        moreLabel={t("native.chats.rowOptions", { name: row.name })} />
                {/each}
            {/each}

            {#if term !== "" && sections.length === 0}
                <span class="none">{$_("native.details.members.noMatch")}</span>
            {/if}
        {/if}
    </div>
</div>

<AnchoredMenu
    anchor={menuAnchor}
    items={menuItems}
    label={$_("native.details.members.options")}
    onSelect={onPick}
    onClose={() => (menuAnchor = null)} />

<ProfileSheet
    person={profile}
    onMessage={message}
    onBlock={blockFromSheet}
    onClose={() => (profile = undefined)} />

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .members {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    // the compact tab bar (40px) under the header, the search under it
    .tabs {
        flex: none;
        padding: var(--space-6) var(--space-16) var(--space-4);
    }

    .field {
        flex: none;
        padding: var(--space-6) var(--space-16) var(--space-10);
    }

    // what the lapsed or the blocked are, over their rows
    .note {
        margin: 0;
        padding: var(--space-8) var(--space-12) var(--space-4);
        font: var(--weight-regular) text-size(13.5px) / 1.45 var(--font-sans);
        color: var(--ink-3);
        text-wrap: pretty;
    }

    // Invite people: a picker row with the accent's invite glyph in place of a face
    .invite {
        flex: none;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: var(--space-12);
        min-height: 60px;
        padding: var(--space-8) var(--space-10);
        border: 0;
        border-radius: 14px;
        background: none;
        color: var(--accent-bright);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--overlay-1);
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .invite-icon {
        flex: none;
        width: 40px;
        height: 40px;
        border-radius: var(--radius-circle);
        background: var(--accent-soft);
        position: relative;

        &::after {
            content: "";
            position: absolute;
            inset: 0;
            margin: auto;
            width: 20px;
            height: 20px;
            mask: var(--icon-invite) center/contain no-repeat;
            background: var(--accent-bright);
        }
    }

    .invite-label {
        font: var(--weight-semibold) text-size(15px) / 1.2 var(--font-sans);
    }

    // picker rows, 6px apart (notes §1 Spacing), clear of the home indicator at the end
    .list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        padding: 0 var(--space-8) var(--scroll-end);
    }

    // a section label: 16px above, 8px when it's the first under the search (notes §1 Spacing)
    .label {
        padding: var(--space-16) var(--space-12) 0;
        font: var(--weight-semibold) text-size(11.5px) / 1 var(--font-mono);
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: var(--ink-4);

        &:first-child {
            padding-top: var(--space-8);
        }
    }

    .none {
        padding: var(--space-24) var(--space-12);
        text-align: center;
        font: var(--weight-medium) text-size(14px) / 1.4 var(--font-sans);
        color: var(--ink-3);
    }
</style>
