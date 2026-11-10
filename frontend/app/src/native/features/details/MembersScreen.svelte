<!-- A group's or channel's members (native plan 10, Design Notes §3.6), pushed from its details: a
     search (a large group holds only its first page of members, so it finds the others as the web's
     panel does), then the members in role sections (Owners, Admins, Moderators, Members), and, for
     someone who can unblock, the blocked. The ⋯ on a member below you offers the roles up to your
     own where your role meets "Change member roles", and Remove and Block where it meets "Remove /
     block members" (logic/members/memberMenu); with neither, it says so in a toast. Removing and
     blocking wait out their Undo before they're sent (a block takes them out of the group, which
     unblocking can't undo); unblocking says they can join again. Tapping a member opens their
     profile sheet. The operations are the web panel's (logic/members/MemberManagement). -->
<script lang="ts">
    import {
        allUsersStore,
        chatIdentifiersEqual,
        chatIdentifierToString,
        chatListScopeStore,
        chatSummariesListStore,
        currentUserIdStore,
        knownMembers,
        memberMatchesSearch,
        ROLE_NONE,
        selectedChatSummaryStore,
        usersFromIds,
        blockOutcome,
        type BlockContext,
        type MemberRole,
        type MultiUserChat,
        type OpenChat,
    } from "@client";
    import AnchoredMenu from "@openchat/ui/src/native/AnchoredMenu.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import type { NativeMenuItem } from "@openchat/ui/src/native/types";
    import { chatWithRoute } from "@src/logic/appEvents/appEvents";
    import { senderColor } from "@src/logic/conversation/messageRow";
    import { memberMenu, memberSections } from "@src/logic/members/memberMenu";
    import { MemberManagement } from "@src/logic/members/memberManagement.svelte";
    import { toastStore, type ToastOutcome } from "@src/stores/toast";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onDestroy, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { NativeScreen } from "../../router/locations";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenProps } from "../app/screens";
    import { blockWithToast } from "../chats/chatToasts";
    import { sendAfterUndo } from "../chats/removeWithUndo";
    import { HeldWhileLeaving } from "../conversation/heldWhileLeaving";
    import { memberMenuItems, menuItemRole, roleWord } from "./details.adapter";
    import MemberListRow from "./MemberListRow.svelte";
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

    // ---- the search: what's held is filtered at once, and the others are looked for

    let query = $state("");
    const term = $derived(query.trim().toLowerCase());
    let cancelFind: (() => void) | undefined;
    onDestroy(() => cancelFind?.());

    function onInput(value: string) {
        query = value;
        cancelFind?.();
        cancelFind = management?.findMembers(value.trim());
    }

    // ---- the members, by role; one being removed or blocked is gone while its Undo shows

    const removalKey = (userId: string) => `member:${chatKey}:${userId}`;

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

    const blocked = $derived(
        management === undefined || !management.canUnblockUsers()
            ? []
            : usersFromIds($allUsersStore, management.blocked).filter((u) =>
                  memberMatchesSearch(term, u),
              ),
    );

    const SECTION_LABELS = {
        owners: "native.details.members.owners",
        admins: "native.details.members.admins",
        moderators: "native.details.members.moderators",
        members: "native.details.members.members",
    } as const;

    // ---- a member's ⋯

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

    function openBlockedMenu(userId: string, name: string, anchor: HTMLElement) {
        target = { userId, name, role: ROLE_NONE };
        menuItems = [{ id: "unblock", label: t("native.details.members.unblock"), icon: "ban" }];
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
            unblock(who.userId, who.name, (userId) => members.unblockUser(userId));
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

    function unblock(
        userId: string,
        name: string,
        setUnblocked: (userId: string) => Promise<ToastOutcome>,
    ) {
        void blockWithToast((id) => setUnblocked(id), context, userId, false, {
            blocking: "",
            blocked: "",
            unblocking: t("native.conversation.toast.unblocking", { name }),
            unblocked: t("native.details.members.unblockedRejoin", { name }),
        });
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
            unblock(person.userId, person.name, (userId) =>
                outcome(client.unblockUserInContext(where, userId)),
            );
        }
    }
</script>

<div class="members">
    <NativePageHeader title={$_("members")} onBack={context.back} />

    <div class="field">
        <input
            value={query}
            oninput={(e) => onInput(e.currentTarget.value)}
            placeholder={$_("native.details.members.search")}
            aria-label={$_("native.details.members.search")}
            enterkeyhint="search"
            autocomplete="off" />
    </div>

    <div class="list">
        {#each sections as section (section.id)}
            <span class="label">
                {t(SECTION_LABELS[section.id], { count: section.members.length })}
            </span>
            {#each section.members as row (row.userId)}
                {@const menu =
                    management === undefined
                        ? undefined
                        : memberMenu(
                              myRole,
                              { role: row.role, isMe: row.isMe },
                              management.actionsFor(row.role, row.isMe),
                          )}
                <MemberListRow
                    name={row.name}
                    username={row.username}
                    photoUrl={row.photoUrl}
                    color={senderColor(row.userId)}
                    isMe={row.isMe}
                    onOpen={() => (profile = { userId: row.userId, name: row.name, isMe: row.isMe })}
                    onMore={menu === undefined || menu.kind === "none"
                        ? undefined
                        : (anchor) => openMenu(row, anchor)}
                    moreLabel={t("native.chats.rowOptions", { name: row.name })} />
            {/each}
        {/each}

        {#if blocked.length > 0}
            <span class="label">
                {t("native.details.members.blocked", { count: blocked.length })}
            </span>
            {#each blocked as user (user.userId)}
                {@const name = user.displayName ?? user.username}
                <MemberListRow
                    {name}
                    username={user.username}
                    photoUrl={user.blobUrl}
                    color={senderColor(user.userId)}
                    isMe={false}
                    onOpen={() => (profile = { userId: user.userId, name, isMe: false })}
                    onMore={(anchor) => openBlockedMenu(user.userId, name, anchor)}
                    moreLabel={t("native.chats.rowOptions", { name })} />
            {/each}
        {/if}

        {#if term !== "" && sections.length === 0 && blocked.length === 0}
            <span class="none">{$_("native.details.members.noMatch")}</span>
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

    .field {
        flex: none;
        padding: var(--space-6) var(--space-16) var(--space-10);
    }

    input {
        box-sizing: border-box;
        width: 100%;
        height: 48px;
        padding: 0 var(--space-16);
        border: 0;
        outline: 0;
        border-radius: 14px;
        background: var(--overlay-1);
        color: var(--ink);
        font: var(--weight-medium) text-size(15px) / 1 var(--font-sans);

        &::placeholder {
            color: var(--ink-4);
        }

        &:focus-visible {
            @include focus-ring;
        }
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
