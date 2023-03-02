<script lang="ts">
    import Panel from "../Panel.svelte";
    import UserProfile from "./profile/UserProfile.svelte";
    import GroupDetails from "./groupdetails/GroupDetails.svelte";
    import AddMembers from "./groupdetails/AddMembers.svelte";
    import Members from "./groupdetails/Members.svelte";
    import PinnedMessages from "./pinned/PinnedMessages.svelte";
    import { rightPanelHistory } from "../../stores/rightPanel";
    import type {
        AddMembersResponse,
        ChatEvent,
        EventWrapper,
        FullMember,
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
    import { numberOfColumns } from "stores/layout";
    import Thread from "./thread/Thread.svelte";
    import ProposalGroupFilters from "./ProposalGroupFilters.svelte";
    import { removeQueryStringParam } from "../../utils/urls";
    import { logger } from "../../utils/logging";
    import { querystring } from "../../routes";
    import page from "page";

    const dispatch = createEventDispatcher();

    const client = getContext<OpenChat>("client");
    const currentUser = client.user;

    let savingMembers = false;

    $: selectedChatId = client.selectedChatId;
    $: selectedChatStore = client.selectedChatStore;
    $: currentChatMembers = client.currentChatMembers;
    $: currentChatBlockedUsers = client.currentChatBlockedUsers;
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

    function onDismissAsAdmin(ev: CustomEvent<string>): void {
        if ($selectedChatId !== undefined) {
            dismissAsAdmin($selectedChatId, ev.detail);
        }
    }

    function onMakeAdmin(ev: CustomEvent<string>): void {
        if ($selectedChatId !== undefined) {
            makeAdmin($selectedChatId, ev.detail);
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

    async function onTransferOwnership(ev: CustomEvent<FullMember>) {
        if ($selectedChatId !== undefined) {
            const success = await transferOwnership($selectedChatId, currentUser.userId, ev.detail);
            if (success) {
                toastStore.showSuccessToast("transferOwnershipSucceeded");
            } else {
                toastStore.showFailureToast("transferOwnershipFailed");
            }
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

    async function saveMembers(ev: CustomEvent<UserSummary[]>) {
        if ($selectedChatId !== undefined) {
            savingMembers = true;
            const success = await addMembers($selectedChatId, false, ev.detail);
            if (success) {
                popHistory();
            } else {
                toastStore.showFailureToast("addMembersFailed");
            }
            savingMembers = false;
        }
    }

    function goToMessageIndex(ev: CustomEvent<{ index: number; preserveFocus: boolean }>): void {
        dispatch("goToMessageIndex", ev.detail);
        if (modal) {
            popHistory();
        }
    }

    function closeThread(_ev: CustomEvent<string>) {
        popHistory();
        page.replace(removeQueryStringParam(new URLSearchParams($querystring), "open"));
    }

    function findMessage(
        events: EventWrapper<ChatEvent>[],
        messageId: bigint
    ): EventWrapper<Message> | undefined {
        return events.find((e) => {
            return e.event.kind === "message" && e.event.messageId === messageId;
        }) as EventWrapper<Message> | undefined;
    }

    function transferOwnershipLocally(chatId: string, me: string, them: string): void {
        chatStateStore.updateProp(chatId, "members", (ps) =>
            ps.map((p) => {
                if (p.userId === them) {
                    return { ...p, role: "owner" as MemberRole };
                }
                if (p.userId === me) {
                    return { ...p, role: "admin" as MemberRole };
                }
                return p;
            })
        );
    }

    function undoTransferOwnershipLocally(
        chatId: string,
        me: string,
        them: string,
        theirRole: MemberRole
    ): void {
        chatStateStore.updateProp(chatId, "members", (ps) =>
            ps.map((p) => {
                if (p.userId === them) {
                    return { ...p, role: theirRole };
                }
                if (p.userId === me) {
                    return { ...p, role: "owner" as MemberRole };
                }
                return p;
            })
        );
    }

    function transferOwnership(chatId: string, me: string, them: FullMember): Promise<boolean> {
        transferOwnershipLocally(chatId, me, them.userId);
        return client
            .changeRole(chatId, them.userId, "owner")
            .then((resp) => {
                if (resp !== "success") {
                    undoTransferOwnershipLocally(chatId, me, them.userId, them.role);
                    return false;
                }
                return true;
            })
            .catch((err) => {
                undoTransferOwnershipLocally(chatId, me, them.userId, them.role);
                logger.error("Unable to transfer ownership", err);
                return false;
            });
    }

    function dismissAsAdmin(chatId: string, userId: string): Promise<void> {
        chatStateStore.updateProp(chatId, "members", (ps) =>
            ps.map((p) => (p.userId === userId ? { ...p, role: "participant" as MemberRole } : p))
        );
        return client
            .changeRole(chatId, userId, "participant")
            .then((resp) => {
                if (resp !== "success") {
                    toastStore.showFailureToast("dismissAsAdminFailed");
                }
            })
            .catch((err) => {
                logger.error("Unable to dismiss as admin", err);
                toastStore.showFailureToast("dismissAsAdminFailed");
            });
    }

    function makeAdmin(chatId: string, userId: string): Promise<void> {
        chatStateStore.updateProp(chatId, "members", (ps) =>
            ps.map((p) => (p.userId === userId ? { ...p, role: "admin" as MemberRole } : p))
        );
        return client
            .changeRole(chatId, userId, "admin")
            .then((resp) => {
                if (resp !== "success") {
                    toastStore.showFailureToast("makeAdminFailed");
                }
            })
            .catch((err) => {
                logger.error("Unable to make admin", err);
                toastStore.showFailureToast("makeAdminFailed");
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
    {:else if lastState.kind === "add_members"}
        <AddMembers
            busy={savingMembers}
            closeIcon={$rightPanelHistory.length > 1 ? "back" : "close"}
            on:saveMembers={saveMembers}
            on:cancelAddMembers={popHistory} />
    {:else if lastState.kind === "show_members" && $selectedChatId !== undefined}
        <Members
            closeIcon={$rightPanelHistory.length > 1 ? "back" : "close"}
            chat={$groupChat}
            members={currentChatMembers}
            blockedUsers={currentChatBlockedUsers}
            on:close={popHistory}
            on:blockUser={onBlockUser}
            on:unblockUser={unblockUser}
            on:transferOwnership={onTransferOwnership}
            on:chatWith
            on:addMembers
            on:dismissAsAdmin={onDismissAsAdmin}
            on:removeMember={onRemoveMember}
            on:makeAdmin={onMakeAdmin} />
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
            rootEvent={threadRootEvent}
            chat={$selectedChatStore}
            on:closeThread={closeThread} />
    {:else if lastState.kind === "proposal_filters" && $selectedChatId !== undefined}
        <ProposalGroupFilters on:close={popHistory} />
    {/if}
</Panel>
