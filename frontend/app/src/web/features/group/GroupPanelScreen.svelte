<!-- The right column's panel for a group, channel or community: its details, members (with what the
     viewer may do to each), pinned messages, rules, access gates and user groups. Members views
     (?everyone, ?usergroup=) and the pinned list open as GroupPanel's own views. Leave and delete
     open the confirm dialogs, settings and invite open Manage on that page, and user groups
     UserGroupDialog; bots … are off until 4b's later parts (TODO(4b)). -->
<script lang="ts">
    import {
        allUsersStore,
        anonUserStore,
        favouritesStore,
        chatIdentifierToString,
        chatListScopeStore,
        compareMembers,
        cryptoLookup,
        currentUserIdStore,
        groupDescription,
        knownMembers,
        nervousSystemLookup,
        OpenChat,
        ROLE_ADMIN,
        ROLE_MEMBER,
        ROLE_OWNER,
        routeForMessage,
        selectedChatRulesStore,
        selectedChatSummaryStore,
        selectedCommunityMembersStore,
        selectedCommunityRulesStore,
        selectedCommunitySummaryStore,
        selectedCommunityUserGroupsStore,
        usersFromIds,
        type MultiUserChat,
    } from "@client";
    import GroupPanel, {
        type MemberRole as PanelRole,
    } from "@openchat/ui/src/features/components/GroupPanel.svelte";
    import {
        MemberManagement,
        type MemberActionOutcome,
    } from "@src/logic/members/memberManagement.svelte";
    import { PinnedMessages } from "@src/logic/pinned/pinnedMessages.svelte";
    import { muteChat } from "@src/logic/chats/muteChat";
    import {
        chatDetailsPermissions,
        chatRulesText,
        communityDetailsPermissions,
        communityMenuPermissions,
    } from "@src/logic/groupOrCommunity/detailsPermissions";
    import { toastStore } from "@src/stores/toast";
    import { navigate } from "@src/utils/navigation";
    import { profileClickedEvent } from "@src/web-components/profileLink";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { closeRightColumn, openPanelOver } from "../app/rightPanel";
    import type { ManageSection } from "@src/logic/groupOrCommunity/manage.svelte";
    import { communityPermissionsValue, permissionsValue } from "./settings.adapter";
    import type { RightRegion, ScreenProps } from "../app/screens";
    import { gateAssets, gatesState } from "../access/gates.adapter";
    import { pickById } from "../../pickById";
    import {
        appRole,
        memberPerson,
        panelHeader,
        pinRow,
        userGroupRow,
        userPerson,
    } from "./group.adapter";
    import { leaveOrDeleteFor } from "./manage.adapter";

    type GroupRegion = Extract<
        RightRegion,
        {
            kind:
                | "group_details"
                | "channel_summary"
                | "community_details"
                | "group_members"
                | "community_members"
                | "channel_or_community_members"
                | "pinned";
        }
    >;

    // what GroupPanel's user group actions send with onDialog("usergroup")
    type UserGroupDialogRequest = { dialogMode: "create" | "edit" | "delete"; key: string | null };

    let { region, context }: ScreenProps<GroupRegion> = $props();

    const PANEL_COLORS = ["violet", "amber", "teal", "blue"] as const;

    const client = getContext<OpenChat>("client");

    // a channel's panel shows the channel or, on its community tab, the community
    const communityScope = $derived(
        region.kind === "community_details" ||
            region.kind === "community_members" ||
            ((region.kind === "channel_summary" ||
                region.kind === "channel_or_community_members") &&
                region.tab === "community"),
    );
    const chat = $derived<MultiUserChat | undefined>(
        $selectedChatSummaryStore?.kind === "group_chat" ||
            $selectedChatSummaryStore?.kind === "channel"
            ? $selectedChatSummaryStore
            : undefined,
    );
    const community = $derived($selectedCommunitySummaryStore);
    const collection = $derived(communityScope ? community : chat);
    const me = $derived($currentUserIdStore);

    const members = $derived(
        collection === undefined ? undefined : new MemberManagement(client, collection),
    );

    const viewRequest = $derived(
        region.kind === "pinned"
            ? "pinned"
            : region.kind === "community_members" && region.userGroupId !== undefined
              ? "usergroups"
              : region.kind === "group_members" ||
                  region.kind === "community_members" ||
                  region.kind === "channel_or_community_members"
                ? "members"
                : null,
    );

    const held = $derived(
        members === undefined
            ? []
            : knownMembers($allUsersStore, members.members.values()).sort(compareMembers),
    );
    const people = $derived(
        members === undefined
            ? []
            : held.map((m) => memberPerson(m, me, members.actionsFor(m.role, m.userId === me))),
    );
    const lapsed = $derived(
        members === undefined
            ? []
            : usersFromIds($allUsersStore, members.lapsed).map((u) => userPerson(u, "LAPSED")),
    );
    const blocked = $derived(
        members === undefined
            ? []
            : usersFromIds($allUsersStore, members.blocked).map((u) => userPerson(u, "BLOCKED")),
    );
    const owner = $derived(held.find((m) => m.role === ROLE_OWNER));

    const header = $derived(
        collection === undefined
            ? undefined
            : panelHeader(
                  collection,
                  collection.kind === "community"
                      ? collection.description
                      : groupDescription(collection, me),
                  // uploaded images only: a swatch stands in otherwise, as in the chat list
                  collection.kind === "community"
                      ? collection.avatar.blobUrl
                      : (collection.blobUrl ?? community?.avatar.blobUrl),
              ),
    );

    // rules show to someone who can send, combined with the community's
    const rules = $derived.by(() => {
        if (collection === undefined) return undefined;
        if (collection.kind === "community") {
            return $selectedCommunityRulesStore === undefined
                ? undefined
                : {
                      enabled: $selectedCommunityRulesStore.enabled,
                      text: $selectedCommunityRulesStore.text,
                  };
        }
        const text = chatRulesText(
            client,
            collection,
            $selectedChatRulesStore,
            $selectedCommunityRulesStore,
        );
        return text === "" ? undefined : { enabled: true, text };
    });

    const gateLookups = $derived({ tokens: $cryptoLookup, nervousSystems: $nervousSystemLookup });
    const gates = $derived(
        collection === undefined ? null : gatesState(collection.gateConfig, gateLookups),
    );
    const assets = $derived(gateAssets(gateLookups));

    // the user groups load their members as they arrive or change
    $effect(() => {
        void $selectedCommunityUserGroupsStore;
        const id = community?.id;
        if (communityScope && id !== undefined) {
            untrack(() => client.loadUserGroupMembers(id));
        }
    });
    const userGroups = $derived(
        communityScope
            ? [...$selectedCommunityUserGroupsStore.values()].map((g) =>
                  userGroupRow(g, $allUsersStore),
              )
            : [],
    );

    // pinned messages load (and are marked read) when the pinned view opens, as the old panel did
    let view = $state<string>();
    const pinned = new PinnedMessages(
        client,
        () => (chat as MultiUserChat).id,
        () => chat?.dateLastPinned,
    );
    $effect(() => {
        if (
            (view === "pinned" || viewRequest === "pinned") &&
            chat !== undefined &&
            !communityScope
        ) {
            void pinned.sync();
        }
    });
    const pinnedEvents = $derived(
        pinned.messages.kind === "success" ? pinned.messages.data.flat() : [],
    );
    const pins = $derived(
        pinnedEvents.map((ev) => {
            const sent = new Date(Number(ev.timestamp));
            return pinRow({
                messageId: ev.event.messageId,
                senderId: ev.event.sender,
                author: client.getDisplayName(ev.event.sender, $selectedCommunityMembersStore),
                text: client.getContentAsText($_, ev.event.content),
                date: client.formatMessageDate(ev.timestamp, $_("today"), $_("yesterday")),
                time: client.toShortTimeString(sent),
            });
        }),
    );

    async function act(outcome: Promise<MemberActionOutcome> | undefined): Promise<void> {
        if (outcome === undefined) throw new Error("no members");
        const result = await outcome;
        toastStore.showOutcome(result);
        // GroupPanel rolls the row back when the promise rejects
        if (result.kind === "failed") throw new Error("member action failed");
    }

    function changeRole(person: { userId?: string }, role: PanelRole) {
        const userId = person.userId;
        if (userId === undefined || members === undefined) return;
        const oldRole = members.members.get(userId)?.role ?? ROLE_MEMBER;
        return act(members.changeRole({ userId, newRole: appRole(role), oldRole }, $_));
    }

    const onPerson =
        (run: (m: MemberManagement, userId: string) => Promise<MemberActionOutcome>) =>
        (person: { userId?: string }) =>
            person.userId === undefined || members === undefined
                ? undefined
                : act(run(members, person.userId));

    let cancelSearch: (() => void) | undefined;
    function searchMembers(query: string) {
        cancelSearch?.();
        cancelSearch = members?.findMembers(query.trim());
    }

    function openPinned(messageId: string) {
        const ev = pinnedEvents.find((e) => String(e.event.messageId) === messageId);
        if (ev === undefined || chat === undefined) return;
        navigate(
            routeForMessage($chatListScopeStore.kind, { chatId: chat.id }, ev.event.messageIndex),
        );
    }

    async function unpin(messageId: string) {
        const ev = pinnedEvents.find((e) => String(e.event.messageId) === messageId);
        if (ev === undefined || chat === undefined) return;
        if (!(await client.unpinMessage(chat.id, ev.event.messageIndex))) {
            throw new Error("unpin failed");
        }
    }

    // A chat mutes without a duration: the panel's spans all mute until unmuted (GAPS.md). A
    // community mutes all its channels, which can't be undone from here (as in the old menus)
    async function mute(key: string | null) {
        if (collection === undefined) return;
        if (collection.kind === "community") {
            if (key === null || !(await client.muteAllChannels(collection.id, false))) {
                throw new Error("can't unmute every channel");
            }
            return;
        }
        const failed = await muteChat(client, collection.id, key !== null, undefined, $_);
        if (failed !== undefined) toastStore.showFailureToast(failed);
    }

    async function muteEveryone(on: boolean) {
        if (collection === undefined) return;
        if (collection.kind === "community") {
            if (!on || !(await client.muteAllChannels(collection.id, true))) {
                throw new Error("can't unmute @everyone in every channel");
            }
            return;
        }
        const failed = await muteChat(client, collection.id, undefined, on, $_);
        if (failed !== undefined) toastStore.showFailureToast(failed);
    }

    const permissions = $derived(
        collection === undefined
            ? undefined
            : collection.kind === "community"
              ? communityDetailsPermissions(client, collection, $anonUserStore)
              : chatDetailsPermissions(client, collection, community, $anonUserStore),
    );

    // GroupPanel offers Leave to everyone, so the rules are checked here (GAPS.md). Settings and
    // invite open Manage: the editor or, for someone who can't edit, the About page.
    // TODO(4b): bots, webhooks, convert, import and new channels (parts 4-5)
    function onDialog(kind: string, payload?: unknown, tab?: string) {
        if (collection === undefined) return;
        if (kind === "usergroup") {
            if (collection.kind === "community" && permissions?.canManageUserGroups) {
                const { dialogMode, key } = payload as UserGroupDialogRequest;
                context.dialogs.open({
                    kind: "user_group",
                    communityId: collection.id,
                    mode: dialogMode,
                    userGroupId: key === null ? undefined : Number(key),
                });
            }
            return;
        }
        if (kind === "invite") {
            if (permissions?.canOpenInvite) {
                context.dialogs.open({
                    kind: "manage",
                    target: collection.id,
                    section: "invite",
                    inviteTab: tab === "share" ? "share" : "people",
                });
            }
            return;
        }
        if (kind === "settings") {
            context.dialogs.open({
                kind: "manage",
                target: collection.id,
                section: manageSection(tab),
            });
            return;
        }
        const allowed =
            kind === "delete"
                ? permissions?.canDelete
                : kind === "leave" &&
                  (collection.kind === "community"
                      ? communityMenuPermissions(client, collection).canLeave
                      : client.canLeaveGroup(collection.id));
        if (allowed) {
            context.dialogs.open({
                kind: "leave_or_delete",
                action: leaveOrDeleteFor(collection, kind as "leave" | "delete"),
                name: collection.name,
            });
        }
    }

    function toggleFavourite() {
        if (collection === undefined || collection.kind === "community") return;
        if ($favouritesStore.has(collection.id)) {
            client.removeFromFavourites(collection.id);
        } else {
            client.addToFavourites(collection.id);
        }
    }

    // GroupPanel's view the settings were opened from, as Manage's page
    function manageSection(view: string | undefined): ManageSection {
        return view === "gates" || view === "rules" || view === "permissions" ? view : "main";
    }

    function close() {
        if (region.back) {
            client.popRightPanelHistory();
        } else {
            closeRightColumn(context.rightColumn);
        }
    }
</script>

{#if collection !== undefined && header !== undefined && members !== undefined}
    <GroupPanel
        scope={collection.kind === "community"
            ? "community"
            : collection.kind === "channel"
              ? "channel"
              : "group"}
        {...header}
        color={pickById(
            collection.kind === "community"
                ? collection.id.communityId
                : chatIdentifierToString(collection.id),
            PANEL_COLORS,
        )}
        ownerHandle={owner?.username ?? ""}
        communityName={collection.kind === "channel" ? community?.name : undefined}
        onOpenCommunity={collection.kind === "channel"
            ? (v) =>
                  openPanelOver(
                      v === "members"
                          ? { kind: "show_community_members" }
                          : { kind: "community_details" },
                  )
            : undefined}
        members={people}
        {lapsed}
        {blocked}
        canModerate={members.canRemoveMembers() || members.canUnblockUsers()}
        canChangeRoles={people.some((p) => p.actions.roles.length > 0)}
        canManageUserGroups={permissions?.canManageUserGroups ?? false}
        canEdit={permissions?.canEdit ?? false}
        canDelete={permissions?.canDelete ?? false}
        permissions={collection.kind === "community"
            ? communityPermissionsValue(collection.permissions)
            : permissionsValue(collection.permissions)}
        isFavourite={collection.kind !== "community" && $favouritesStore.has(collection.id)}
        coverUrl={collection.kind === "community" ? collection.banner.blobUrl : undefined}
        onToggleFavourite={collection.kind === "community" ? undefined : toggleFavourite}
        {onDialog}
        canInvite={permissions?.canOpenInvite ?? false}
        canPin={collection.kind !== "community" && client.canPinMessages(collection.id)}
        userGroups={collection.kind === "community" ? userGroups : undefined}
        gateState={gates}
        gateTokens={assets.tokens}
        gateSystems={assets.nervousSystems}
        {rules}
        pinned={pins}
        mutedUntil={collection.kind === "community"
            ? undefined
            : collection.membership.notificationsMuted
              ? "always"
              : null}
        muteEveryone={collection.kind === "community"
            ? undefined
            : collection.membership.atEveryoneMuted}
        onMuteChange={mute}
        onMuteEveryoneChange={muteEveryone}
        ownerCount={held.filter((m) => m.role === ROLE_OWNER).length}
        adminCount={held.filter((m) => m.role === ROLE_ADMIN).length}
        {viewRequest}
        storageKey=""
        onViewChange={(v) => (view = v)}
        onRoleChange={changeRole}
        onRemoveMember={onPerson((m, id) => m.removeMember(id))}
        onBlockMember={onPerson((m, id) => m.blockUser(id))}
        onUnblock={onPerson((m, id) => m.unblockUser(id))}
        onSearchMembers={searchMembers}
        onOpenOwner={owner === undefined
            ? undefined
            : () => document.body.dispatchEvent(profileClickedEvent(owner.userId))}
        onOpenPinned={openPinned}
        onUnpin={unpin}
        back={region.back}
        onClose={close}
    />
{/if}
