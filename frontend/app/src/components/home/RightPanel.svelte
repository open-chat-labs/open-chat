<script lang="ts">
    import Panel from "../Panel.svelte";
    import UserProfile from "./profile/UserProfile.svelte";
    import GroupDetails from "./groupdetails/GroupDetails.svelte";
    import InviteUsers from "./groupdetails/InviteUsers.svelte";
    import Members from "./groupdetails/Members.svelte";
    import PinnedMessages from "./pinned/PinnedMessages.svelte";
    import { rightPanelHistory } from "../../stores/rightPanel";
    import type {
        AddMembersResponse,
        ChatEvent,
        EventWrapper,
        GroupChatSummary,
        GroupRules,
        MemberRole,
        Message,
        UserSummary,
        OpenChat,
    } from "openchat-client";
    import { toastStore } from "../../stores/toast";
    import { createEventDispatcher, getContext } from "svelte";
    import type { Readable } from "svelte/store";
    import { _ } from "svelte-i18n";
    import { numberOfColumns } from "stores/layout";
    import Thread from "./thread/Thread.svelte";
    import ProposalGroupFilters from "./ProposalGroupFilters.svelte";
    import { removeQueryStringParam, removeThreadMessageIndex } from "../../utils/urls";
    import { logger } from "../../utils/logging";
    import { pathParams } from "../../routes";
    import page from "page";
    import { compareRoles } from "openchat-shared";

    const dispatch = createEventDispatcher();

    const client = getContext<OpenChat>("client");
    const currentUser = client.user;

    let invitingUsers = false;

    $: selectedChatId = client.selectedChatId;
    $: selectedChatStore = client.selectedChatStore;
    $: currentChatMembers = client.currentChatMembers;
    $: currentChatPinnedMessages = client.currentChatPinnedMessages;
    $: currentChatRules = client.currentChatRules;
    $: chatStateStore = client.chatStateStore;
    $: eventsStore = client.eventsStore;
    $: userStore = client.userStore;
    $: user = $userStore[currentUser.userId] ?? client.nullUser("unknown");
    $: lastState = $rightPanelHistory[$rightPanelHistory.length - 1] ?? { kind: "no_panel" };
    $: modal = $numberOfColumns === 2;
    $: groupChat = selectedChatStore as Readable<GroupChatSummary>;
    $: empty = $rightPanelHistory.length === 0;

    function onChangeRole(
        ev: CustomEvent<{ userId: string; newRole: MemberRole; oldRole: MemberRole }>
    ): void {
        if ($selectedChatId !== undefined) {
            let { userId, newRole, oldRole } = ev.detail;
            changeRole($selectedChatId, userId, newRole, oldRole);
        }
    }

    function onRemoveMember(ev: CustomEvent<string>): void {
        if ($selectedChatId !== undefined) {
            chatStateStore.updateProp($selectedChatId, "members", (ps) =>
                ps.filter((p) => p.userId !== ev.detail)
            );
            removeMember($selectedChatId, ev.detail);
        }
    }

    function popHistory() {
        rightPanelHistory.update((history) => history.slice(0, history.length - 1));
    }

    function onBlockUser(ev: CustomEvent<{ userId: string }>) {
        if ($selectedChatId !== undefined) {
            client.blockUser($selectedChatId, ev.detail.userId);
        }
    }

    async function unblockUser(ev: CustomEvent<UserSummary>) {
        if ($selectedChatId !== undefined) {
            const success = await addMembers($selectedChatId, true, [ev.detail]);
            if (success) {
                toastStore.showSuccessToast("unblockUserSucceeded");
            } else {
                toastStore.showFailureToast("unblockUserFailed");
            }
        }
    }

    async function inviteUsers(ev: CustomEvent<UserSummary[]>) {
        if ($selectedChatId !== undefined) {
            const userIds = ev.detail.map((u) => u.userId);

            invitingUsers = true;

            await client
                .inviteUsers($selectedChatId, userIds)
                .then((resp) => {
                    switch (resp) {
                        case "success":
                            popHistory();
                            break;                        
                        case "too_many_invites":
                            toastStore.showFailureToast("group.tooManyInvites");
                            break;
                        default:
                            toastStore.showFailureToast("group.inviteUsersFailed");
                            break;
                    }
                })
                .catch((err) => {
                    logger.error("InviteUsersFailed", err);
                    toastStore.showFailureToast("group.inviteUsersFailed");
                });

            invitingUsers = false;
        }
    }

    function goToMessageIndex(ev: CustomEvent<{ index: number; preserveFocus: boolean }>): void {
        dispatch("goToMessageIndex", ev.detail);
        if (modal) {
            popHistory();
        }
    }

    function stripThreadFromUrl(path: string) {
        if ($pathParams.threadMessageIndex !== undefined) {
            return removeThreadMessageIndex($pathParams.threadMessageIndex, path);
        }
        return path;
    }

    function closeThread(_ev: CustomEvent<string>) {
        popHistory();
        page.replace(stripThreadFromUrl(removeQueryStringParam("open")));
    }

    function findMessage(
        events: EventWrapper<ChatEvent>[],
        messageId: bigint
    ): EventWrapper<Message> | undefined {
        return events.find((e) => {
            return e.event.kind === "message" && e.event.messageId === messageId;
        }) as EventWrapper<Message> | undefined;
    }

    function changeRole(
        chatId: string,
        userId: string,
        newRole: MemberRole,
        oldRole: MemberRole
    ): Promise<void> {
        if (newRole === oldRole) return Promise.resolve();

        let promotion = compareRoles(newRole, oldRole) > 0;

        function onError(err: any) {
            // Revert the local store
            chatStateStore.updateProp(chatId, "members", (ps) =>
                ps.map((p) => (p.userId === userId ? { ...p, role: oldRole } : p))
            );

            let roleText = $_(newRole);
            let message = $_(promotion ? "promoteFailed" : "demoteFailed", {
                values: { role: roleText },
            });
            if (err) {
                logger.error(message, err);
            }
            toastStore.showFailureToast(message);
        }

        // Update the local store
        chatStateStore.updateProp(chatId, "members", (ps) =>
            ps.map((p) => (p.userId === userId ? { ...p, role: newRole } : p))
        );

        // Call backend to changeRole
        return client
            .changeRole(chatId, userId, newRole)
            .then((resp) => {
                if (resp !== "success") {
                    onError(undefined);
                }
            })
            .catch((err) => {
                onError(err);
            });
    }

    function removeMember(chatId: string, userId: string): Promise<void> {
        return client
            .removeMember(chatId, userId)
            .then((resp) => {
                if (resp !== "success") {
                    toastStore.showFailureToast("removeMemberFailed");
                }
            })
            .catch((err) => {
                logger.error("Unable to remove member", err);
                toastStore.showFailureToast("removeMemberFailed");
            });
    }

    function removeMembersLocally(
        chatId: string,
        viaUnblock: boolean,
        users: UserSummary[],
        resp: AddMembersResponse | { kind: "unknown" }
    ): void {
        if (resp.kind === "add_members_success") return;

        let toRemove: string[] = [];
        if (resp.kind === "add_members_partial_success") {
            toRemove = [
                ...resp.usersAlreadyInGroup,
                ...resp.usersBlockedFromGroup,
                ...resp.usersWhoBlockedRequest,
            ];
        } else {
            toRemove = users.map((u) => u.userId);
        }

        chatStateStore.updateProp(chatId, "members", (ps) =>
            ps.filter((p) => {
                !toRemove.includes(p.userId);
            })
        );

        if (viaUnblock) {
            chatStateStore.updateProp(chatId, "blockedUsers", (b) => {
                return toRemove.reduce((blocked, u) => blocked.add(u), b);
            });
        }
    }

    function addMembersLocally(chatId: string, viaUnblock: boolean, users: UserSummary[]): void {
        if (viaUnblock) {
            chatStateStore.updateProp(chatId, "blockedUsers", (b) => {
                users.forEach((u) => b.delete(u.userId));
                return b;
            });
        }
        chatStateStore.updateProp(chatId, "members", (ps) => [
            ...users.map((u) => ({
                userId: u.userId,
                role: "participant" as MemberRole,
            })),
            ...ps,
        ]);
    }

    function addMembers(
        chatId: string,
        viaUnblock: boolean,
        users: UserSummary[]
    ): Promise<boolean> {
        addMembersLocally(chatId, viaUnblock, users);
        return client
            .addMembers(
                chatId,
                users.map((u) => u.userId),
                currentUser.username,
                viaUnblock
            )
            .then((resp) => {
                if (resp.kind === "add_members_success") {
                    return true;
                } else {
                    removeMembersLocally(chatId, viaUnblock, users, resp);
                    return false;
                }
            })
            .catch((err) => {
                removeMembersLocally(chatId, viaUnblock, users, { kind: "unknown" });
                logger.error("AddMembersFailed", err);
                return false;
            });
    }

    function updateGroupRules(ev: CustomEvent<{ chatId: string; rules: GroupRules }>) {
        chatStateStore.setProp(ev.detail.chatId, "rules", ev.detail.rules);
    }

    $: threadRootEvent =
        lastState.kind === "message_thread_panel" && $selectedChatId !== undefined
            ? findMessage($eventsStore, lastState.threadRootMessageId)
            : undefined;
</script>

<Panel right {empty}>
    {#if lastState.kind === "group_details" && $selectedChatId !== undefined}
        <GroupDetails
            chat={$groupChat}
            memberCount={$currentChatMembers.length}
            rules={$currentChatRules}
            on:close={popHistory}
            on:updateGroupRules={updateGroupRules}
            on:deleteGroup
            on:editGroup
            on:chatWith
            on:showMembers />
    {:else if lastState.kind === "invite_members"}
        <InviteUsers
            busy={invitingUsers}
            closeIcon={$rightPanelHistory.length > 1 ? "back" : "close"}
            on:inviteUsers={inviteUsers}
            on:cancelInviteUsers={popHistory} />
    {:else if lastState.kind === "show_members" && $selectedChatId !== undefined}
        <Members
            closeIcon={$rightPanelHistory.length > 1 ? "back" : "close"}
            chat={$groupChat}
            on:close={popHistory}
            on:blockUser={onBlockUser}
            on:unblockUser={unblockUser}
            on:chatWith
            on:addMembers
            on:removeMember={onRemoveMember}
            on:changeRole={onChangeRole} />
    {:else if lastState.kind === "show_pinned" && $selectedChatId !== undefined}
        <PinnedMessages
            on:chatWith
            on:goToMessageIndex={goToMessageIndex}
            chatId={$selectedChatId}
            pinned={$currentChatPinnedMessages}
            dateLastPinned={$groupChat.dateLastPinned}
            on:close={popHistory} />
    {:else if lastState.kind === "user_profile"}
        <UserProfile
            on:unsubscribeNotifications={() => client.setSoftDisabled(true)}
            on:upgrade
            on:showFaqQuestion
            {user}
            on:userAvatarSelected
            on:closeProfile={popHistory} />
    {:else if threadRootEvent !== undefined && $selectedChatStore !== undefined}
        <Thread
            on:chatWith
            on:upgrade
            on:replyPrivatelyTo
            rootEvent={threadRootEvent}
            chat={$selectedChatStore}
            on:closeThread={closeThread} />
    {:else if lastState.kind === "proposal_filters" && $selectedChatId !== undefined}
        <ProposalGroupFilters on:close={popHistory} />
    {/if}
</Panel>
