<!-- Invite people (native plan 10), pushed from a group's or channel's details (its Invite tile) and
     its Members screen. "Invite people" over the chat's name, then People | Invite link (the web's
     InviteDialog's tabs), each only for someone it's for (logic/members/invitePeople); one alone
     shows without the tab bar.
     People: a search by name or @username (the library's Field, with its clear ×), the people
     picked as chips ("No one selected yet" until there are), then with nothing searched
     Pending (invited, not accepted yet; Cancel, with Undo) and Suggested (people the user has DMs
     with who aren't in it), and with a search its Results: everyone found, members and those
     already invited dimmed and marked. The pinned button sends them: a private community's members
     are added to its channel, everyone else invited (MemberManagement.sendPicked); the screen stays,
     with a toast, the search cleared and those invited under Pending. With nothing pending or to
     suggest, a hint to search. Invite link: the switch ("Share via link"), and while it's on the QR code, the link,
     Copy link and Share (the system's share sheet), and Reset link (a row saying what it does),
     whose Undo works by waiting: the link is reset once its toast has gone. The link's switch and
     reset are for those who may invite to a private chat; a public chat's link is always on. -->
<script lang="ts">
    import {
        allUsersStore,
        anonUserStore,
        chatIdentifiersEqual,
        chatIdentifierToString,
        currentUserIdStore,
        knownMembers,
        memberMatchesSearch,
        selectedChatSummaryStore,
        selectedCommunityMembersStore,
        selectedCommunitySummaryStore,
        serverDirectChatsStore,
        directChatUsers,
        usersFromIds,
        type MultiUserChat,
        type OpenChat,
        type UserSummary,
    } from "@client";
    import { Optimistic } from "@openchat/ui/src/lib/behaviours/optimistic.svelte";
    import { copyText } from "@openchat/ui/src/lib/clipboard";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import Field from "@openchat/ui/src/lib/components/Field.svelte";
    import SegmentedTabs from "@openchat/ui/src/lib/components/SegmentedTabs.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import UserChip from "@openchat/ui/src/lib/components/UserChip.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import SettingsAction from "@openchat/ui/src/native/SettingsAction.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import SettingsSwitch from "@openchat/ui/src/native/SettingsSwitch.svelte";
    import QRCode from "@src/core/QRCode.svelte";
    import { i18nKey, interpolate } from "@src/i18n/i18n";
    import { searchTerm } from "@src/logic/chats/chatSearch";
    import { TermSearch } from "@src/logic/chats/termSearch.svelte";
    import { senderColor } from "@src/logic/conversation/messageRow";
    import {
        chatInviteAccess,
        invitePeopleLists,
        inviteWay,
        pickable,
        type InviteTab,
        type InviteWayContext,
    } from "@src/logic/members/invitePeople";
    import { MemberManagement, searchToInvite } from "@src/logic/members/memberManagement.svelte";
    import { toastStore } from "@src/stores/toast";
    import { shareLink } from "@src/utils/share";
    import { getContext, onDestroy, onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { aboveKeyboard } from "../../aboveKeyboard.svelte";
    import type { NativeScreen } from "../../router/locations";
    import type { ScreenProps } from "../app/screens";
    import { sendAfterUndo } from "../chats/removeWithUndo";
    import { HeldWhileLeaving } from "../conversation/heldWhileLeaving";
    import { chipName, linkTabView, sendLabel, sentToast } from "./invite.adapter";
    import InviteRow from "./InviteRow.svelte";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "invite_people" }>> =
        $props();

    const client = getContext<OpenChat>("client");

    const t = (key: string, values?: Record<string, string | number>) => $_(key, { values });
    // a key that names the chat's kind ("this group", "this channel")
    const tl = (key: string) => interpolate($_, i18nKey(key, undefined, chat?.level, true));

    // the chat is the selected one (the details'), held while the screen slides out
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
    const community = $derived(
        chat?.kind === "channel" ? $selectedCommunitySummaryStore : undefined,
    );
    const me = $derived($currentUserIdStore);

    // the operations, and the picks, for the chat it was opened for (the screen is that chat's)
    const management = untrack(() =>
        chat === undefined ? undefined : new MemberManagement(client, chat),
    );

    const access = $derived(
        chat === undefined
            ? ({ kind: "not_allowed" } as const)
            : chatInviteAccess(client, chat, community, $anonUserStore),
    );
    const tabs = $derived<InviteTab[]>(access.kind === "allowed" ? access.tabs : []);
    let chosen = $state<InviteTab>("people");
    const tab = $derived<InviteTab>(tabs.includes(chosen) ? chosen : (tabs[0] ?? "people"));

    // Suggested waits for the DM partners to be looked up among the members (a large group or
    // channel, or a channel's community, holds only its first page of them: the old Add page's
    // lookup), so a member it doesn't hold isn't offered to invite
    let suggestionsLoaded = $state(false);
    onMount(async () => {
        try {
            await client.lookupDirectChatUsersAmongMembers();
        } catch (err) {
            console.warn("Unable to look up the DM partners among the members", err);
        } finally {
            suggestionsLoaded = true;
        }
    });

    // ---- People: how each person would join

    const wayContext = $derived<InviteWayContext>({
        me,
        members: management?.members ?? new Map(),
        lapsed: management?.lapsed ?? new Set(),
        invited: management?.invited ?? new Set(),
        communityMembers: chat?.kind === "channel" ? $selectedCommunityMembersStore : undefined,
        invite: access.kind === "allowed" && access.invite,
        add: access.kind === "allowed" && access.add,
        inviteOutsiders: community !== undefined && client.canInviteUsers(community.id),
    });

    let query = $state("");
    const term = $derived(searchTerm(query));
    const people = new TermSearch<UserSummary[]>(async (term) => {
        if (chat === undefined) return [];
        const [inCommunity, others] = await searchToInvite(client, chat.level, term);
        return [...inCommunity, ...others];
    });
    onDestroy(() => people.dispose());

    function onInput(next: string) {
        query = next;
        people.set(searchTerm(next));
    }

    const cancelKey = (userId: string) => `invite:${chatKey}:${userId}`;

    // the invited, but not one whose invite is being cancelled (it waits out its Undo)
    const invited = $derived(
        management === undefined
            ? []
            : usersFromIds($allUsersStore, management.invited).filter(
                  (u) => !context.removals.has(cancelKey(u.userId)),
              ),
    );

    const found = $derived.by((): UserSummary[] => {
        const results = people.results;
        return results.kind === "found" && results.term === term ? results.found : [];
    });

    const lists = $derived(
        invitePeopleLists(
            {
                searching: term !== "",
                invited,
                suggested: suggestionsLoaded
                    ? directChatUsers($serverDirectChatsStore, $allUsersStore)
                    : "loading",
                // those found, then the invited and the members held who match (the search
                // leaves members out)
                matches:
                    term === ""
                        ? []
                        : [
                              ...found.filter((u) => u.userId !== me),
                              ...invited.filter((u) => memberMatchesSearch(term, u)),
                              ...(management === undefined
                                  ? []
                                  : knownMembers($allUsersStore, management.members.values()).filter(
                                        (m) => m.userId !== me && memberMatchesSearch(term, m),
                                    )),
                          ],
            },
            wayContext,
        ),
    );
    const searching = $derived(term !== "" && people.results.kind === "searching");

    const picks = $derived(management?.usersToAddOrInvite ?? []);
    const picked = $derived(
        picks.map((u) => ({ way: inviteWay(u.userId, wayContext), name: displayName(u) })),
    );

    function displayName(user: UserSummary): string {
        return user.displayName ?? user.username;
    }

    function cancelInvite(user: UserSummary) {
        const members = management;
        if (members === undefined) return;
        sendAfterUndo(
            context,
            cancelKey(user.userId),
            t("native.invite.cancelled", { name: displayName(user) }),
            async () => {
                const outcome = await members.cancelInvite(user.userId);
                if (outcome.kind === "failed") toastStore.showOutcome(outcome);
            },
        );
    }

    async function send() {
        const members = management;
        if (members === undefined || picks.length === 0 || members.inviting) return;
        // how each would join now: anyone who's joined or been invited since isn't sent
        const ctx = wayContext;
        const outcome = await members.sendPicked((userId) => inviteWay(userId, ctx));
        if (outcome.kind === "failed") {
            toastStore.showOutcome(outcome);
            return;
        }
        if (outcome.kind === "none_left") {
            context.toast($_("native.invite.noneLeft"));
            return;
        }
        // stays on the screen: those sent leave the picks and those invited show under Pending;
        // any not sent stay picked, and the toast says why after saying who went
        onInput("");
        if (outcome.added.length === 0 && outcome.invited.length === 0) return;
        context.toast(
            sentToast(
                outcome.added.map(displayName),
                outcome.invited.map(displayName),
                t,
                outcome.kind === "partly_sent" ? interpolate($_, outcome.message) : undefined,
            ),
        );
    }

    // ---- Invite link: loaded as the screen opens, or as the tab comes (the chat's access
    // changing), for someone the tab's for; one that couldn't load says so, with Try again

    const link = $derived(management?.inviteLink);
    const url = $derived(management?.sharingLink);

    $effect(() => {
        if (tabs.includes("link") && management?.inviteLinkLoad.kind === "idle") {
            untrack(() => void management.initialiseSharing());
        }
    });

    // the switch: shown at once, back with a toast if it's refused (a public chat's is always on)
    const sharing = new Optimistic(() => link?.kind === "enabled" || link?.kind === "public");
    $effect.pre(() => {
        void link;
        untrack(() => sharing.sync());
    });
    const linkView = $derived(
        linkTabView(management?.inviteLinkLoad ?? { kind: "idle" }, sharing.current, url),
    );
    const switchable = $derived(
        access.kind === "allowed" &&
            access.manageLink &&
            (link?.kind === "enabled" || link?.kind === "disabled"),
    );

    async function toggleSharing(on: boolean) {
        const members = management;
        if (members === undefined || !switchable) return;
        const saved = await sharing.set(on, async (value) => {
            const outcome = await members.toggleInviteLink(value);
            if (outcome.kind === "failed") throw new Error("not changed");
        });
        if (!saved) context.toast($_("native.details.saveFailed"));
    }

    async function copyLink() {
        if (url !== undefined && (await copyText(url))) context.toast($_("linkCopiedToClipboard"));
    }

    // Reset: the old link can't come back once it's reset, so the reset waits out its Undo (the
    // shell's PendingRemovals); meanwhile the link shows dimmed, and once it's sent, a spinner
    // until the new one is in
    const resetKey = $derived(`invite_link:${chatKey}`);
    const resetWaiting = $derived(context.removals.has(resetKey));
    let resetting = $state(false);
    const linkBusy = $derived(resetWaiting || resetting);

    function resetLink() {
        const members = management;
        if (members === undefined || linkBusy) return;
        sendAfterUndo(context, resetKey, $_("native.invite.linkReset"), async () => {
            resetting = true;
            try {
                const outcome = await members.confirmResetLinkResponse(true);
                if (outcome.kind === "failed") toastStore.showOutcome(outcome);
            } finally {
                resetting = false;
            }
        });
    }
</script>

<div class="invite">
    <NativePageHeader title={$_("native.invite.title")} sub={chat?.name ?? ""} onBack={context.back} />

    {#if tabs.length > 1}
        <div class="tabs">
            <SegmentedTabs
                size="sm"
                labels={tabs.map((id) => $_(`native.invite.tabs.${id}`))}
                selectedIndex={tabs.indexOf(tab)}
                dotIndexes={[]}
                onSelect={(i) => (chosen = tabs[i] ?? chosen)} />
        </div>
    {/if}

    {#if tab === "people" && tabs.includes("people")}
        <div class="field">
            <Field
                placeholder={$_("native.invite.search")}
                value={query}
                onInput={(e) => onInput(e.currentTarget.value)}
                onClear={() => onInput("")}
                showShortcut={false} />
        </div>

        <div class="chips" class:empty={picks.length === 0}>
            {#each picks as user (user.userId)}
                <UserChip
                    label={chipName(displayName(user), user.username)}
                    photoUrl={user.blobUrl}
                    color={senderColor(user.userId)}
                    onRemove={() => management?.togglePicked(user)} />
            {:else}
                <span class="placeholder">
                    <span class="placeholder-icon" aria-hidden="true"></span>
                    {$_("native.invite.noneSelected")}
                </span>
            {/each}
        </div>

        <div class="list" {@attach aboveKeyboard()}>
            {#if term === ""}
                {#if lists.pending.length > 0}
                    <span class="label">{t("native.invite.pending", { count: lists.pending.length })}</span>
                    {#each lists.pending as user (user.userId)}
                        <InviteRow
                            name={displayName(user)}
                            sub={$_("native.invite.pendingSub")}
                            photoUrl={user.blobUrl}
                            color={senderColor(user.userId)}
                            end={management?.canUninvite()
                                ? {
                                      kind: "cancel",
                                      label: $_("native.invite.cancel"),
                                      onCancel: () => cancelInvite(user),
                                  }
                                : { kind: "mark", label: $_("native.invite.invited") }} />
                    {/each}
                {/if}
                {#if lists.hint}
                    <span class="hint">
                        <span class="hint-icon" aria-hidden="true"></span>
                        {$_("native.invite.searchHint")}
                    </span>
                {/if}
                {#if lists.suggestedLoading}
                    <span class="label">
                        {$_("native.invite.suggested")}
                        <Spinner size={12} />
                    </span>
                {:else if lists.suggested.length > 0}
                    <span class="label">{$_("native.invite.suggested")}</span>
                    {#each lists.suggested as user (user.userId)}
                        <InviteRow
                            name={displayName(user)}
                            sub={`@${user.username}`}
                            photoUrl={user.blobUrl}
                            color={senderColor(user.userId)}
                            end={{
                                kind: "check",
                                on: management?.isPicked(user.userId) ?? false,
                                onToggle: () => management?.togglePicked(user),
                            }} />
                    {/each}
                {/if}
            {:else}
                <span class="label">
                    {$_("native.invite.results")}
                    {#if searching}<Spinner size={12} />{/if}
                </span>
                {#each lists.results as user (user.userId)}
                    <InviteRow
                        name={displayName(user)}
                        sub={`@${user.username}`}
                        photoUrl={user.blobUrl}
                        color={senderColor(user.userId)}
                        end={pickable(user.way)
                            ? {
                                  kind: "check",
                                  on: management?.isPicked(user.userId) ?? false,
                                  onToggle: () => management?.togglePicked(user),
                              }
                            : {
                                  kind: "mark",
                                  label: $_(
                                      user.way === "member"
                                          ? "native.invite.member"
                                          : "native.invite.invited",
                                  ),
                              }} />
                {:else}
                    {#if !searching}
                        <span class="none">{$_("native.invite.noMatch")}</span>
                    {/if}
                {/each}
            {/if}
        </div>

        <div class="footer">
            <Button
                label={sendLabel(picked, t)}
                icon="send"
                size="lg"
                fullWidth
                disabled={picks.length === 0 || (management?.inviting ?? false)}
                onClick={() => void send()} />
        </div>
    {:else if tab === "link" && tabs.includes("link")}
        <div class="list link-tab">
            <SettingsGroup>
                <SettingsSwitch
                    label={$_("native.invite.shareViaLink")}
                    help={tl("native.invite.shareViaLinkHelp")}
                    on={sharing.current}
                    disabled={!switchable || linkBusy}
                    onChange={(on) => void toggleSharing(on)} />
            </SettingsGroup>

            {#if linkView.kind === "loading"}
                <!-- the link loading, or switched on and its code on its way -->
                <div class="card loading"><Spinner size={20} /></div>
            {:else if linkView.kind === "failed"}
                <div class="card failed">
                    <span class="failed-text">{$_("native.invite.linkFailed")}</span>
                    <Button
                        label={$_("native.invite.retry")}
                        variant="secondary"
                        icon="refresh"
                        onClick={() => void management?.initialiseSharing()} />
                </div>
            {:else if linkView.kind === "link"}
                {@const linkUrl = linkView.url}
                <div class="card" class:waiting={resetWaiting}>
                    <div class="qr">
                        {#if resetting}
                            <Spinner size={24} />
                        {:else}
                            <QRCode text={linkUrl} />
                        {/if}
                    </div>
                    <span class="url">{linkUrl.replace(/^https?:\/\//, "")}</span>
                    <div class="buttons">
                        <Button
                            label={$_("native.invite.copyLink")}
                            variant="secondary"
                            icon="copy"
                            fullWidth
                            disabled={linkBusy}
                            onClick={() => void copyLink()} />
                        <Button
                            label={$_("native.invite.share")}
                            icon="share"
                            fullWidth
                            disabled={linkBusy}
                            onClick={() => void shareLink(linkUrl)} />
                    </div>
                </div>

                {#if access.kind === "allowed" && access.manageLink && link?.kind === "enabled"}
                    <SettingsGroup>
                        <SettingsAction
                            label={$_("native.invite.resetLink")}
                            help={$_("native.invite.resetHelp")}
                            icon="refresh"
                            danger
                            onClick={resetLink} />
                    </SettingsGroup>
                {/if}

                {#if linkView.gatesIgnored}
                    <p class="footnote">
                        <span class="shield" aria-hidden="true"></span>
                        {$_("native.invite.gatesIgnored")}
                    </p>
                {/if}
            {:else}
                <p class="off">{$_("native.invite.linkOff")}</p>
            {/if}
        </div>
    {/if}
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .invite {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    // the compact tab bar (40px) under the header
    .tabs {
        flex: none;
        padding: var(--space-6) var(--space-16) var(--space-4);
    }

    // the library's search field (with its clear ×)
    .field {
        flex: none;
        padding: var(--space-6) var(--space-16) var(--space-10);
    }

    // the people picked, over a divider with room either side (the user's call, 2026-11-10: 12px
    // over it and the plan's 14px under it read cramped)
    .chips {
        flex: none;
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-8);
        max-height: 104px;
        overflow-y: auto;
        margin: 0 var(--space-16) var(--space-22);
        padding: var(--space-4) 0 var(--space-18);
        box-shadow: inset 0 -1px 0 var(--line-1);
    }

    .placeholder {
        display: flex;
        align-items: center;
        gap: var(--space-8);
        padding: 7px 0;
        font: var(--weight-medium) text-size(14px) / 1.2 var(--font-sans);
        color: var(--ink-4);
    }

    .placeholder-icon {
        @include icon(users, 16px, var(--ink-4));
    }

    // picker rows, 6px apart (notes §1 Spacing)
    .list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        padding: 0 var(--space-8) var(--space-16);
    }

    // nothing pending or to suggest: where to start
    .hint {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-10);
        padding: 48px var(--space-24) 0;
        text-align: center;
        font: var(--weight-medium) text-size(14px) / 1.4 var(--font-sans);
        color: var(--ink-4);
    }

    .hint-icon {
        @include icon(search, 28px, currentColor);
        opacity: 0.7;
    }

    .label {
        display: flex;
        align-items: center;
        gap: var(--space-8);
        padding: var(--space-16) var(--space-12) 0;
        font: var(--weight-semibold) text-size(11.5px) / 1 var(--font-mono);
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: var(--ink-4);

        &:first-child {
            padding-top: 0;
        }
    }

    .none,
    .off,
    .failed-text {
        margin: 0;
        padding: var(--space-24) var(--space-12);
        text-align: center;
        font: var(--weight-medium) text-size(14px) / 1.4 var(--font-sans);
        color: var(--ink-3);
        text-wrap: pretty;
    }

    .footer {
        flex: none;
        padding: 12px var(--space-16) var(--bar-end);
    }

    // ---- the link

    .link-tab {
        gap: var(--space-16);
        padding: var(--space-10) var(--space-16) var(--scroll-end);
    }

    .card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-14);
        padding: var(--space-18) var(--space-16) var(--space-16);
        border-radius: 16px;
        background: var(--overlay-1);
        transition: opacity var(--duration-fast) ease;

        &.loading {
            padding: var(--space-24);
        }

        // the link couldn't load: a line, and Try again
        &.failed {
            gap: var(--space-4);
        }

        // reset, waiting out its Undo: the old link, not to be shared now
        &.waiting {
            opacity: 0.45;
        }
    }

    // the QR code on a white tile, whatever the theme, so phones' cameras read it (the library's
    // WalletReceive's too: no token is white in both modes)
    .qr {
        width: 184px;
        height: 184px;
        box-sizing: border-box;
        padding: var(--space-10);
        border-radius: 14px;
        background: #fff;
        @include flex-center;
    }

    .url {
        max-width: 100%;
        font: var(--weight-semibold) text-size(13px) / 1.45 var(--font-mono);
        color: var(--ink);
        text-align: center;
        overflow-wrap: anywhere;
    }

    .buttons {
        align-self: stretch;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-10);
    }

    .footnote {
        margin: 0;
        display: flex;
        align-items: flex-start;
        gap: var(--space-8);
        padding: 0 var(--space-4);
        font: var(--weight-regular) text-size(13px) / 1.45 var(--font-sans);
        color: var(--ink-3);
    }

    .shield {
        flex: none;
        margin-top: 1px;
        @include icon(shield, 16px);
        background: var(--ink-3);
    }

    @media (prefers-reduced-motion: reduce) {
        .card {
            transition: none;
        }
    }
</style>
