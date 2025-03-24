<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import Avatar from "../../Avatar.svelte";
    import ClockOutline from "svelte-material-icons/ClockOutline.svelte";
    import Markdown from "../Markdown.svelte";
    import {
        AvatarSize,
        type UserSummary,
        type PublicProfile,
        type ChatSummary,
        type CommunitySummary,
        type OpenChat,
        type ResourceKey,
        currentUser as createdUser,
        platformModerator,
        selectedChatStore as selectedChat,
        blockedUsers,
        currentChatBlockedUsers,
        currentCommunityBlockedUsers,
        selectedCommunity,
        currentCommunityMembers as communityMembers,
        currentChatMembersMap as chatMembersMap,
    } from "openchat-client";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContentLegacy.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import { rightPanelHistory } from "../../../stores/rightPanel";
    import { toastStore } from "../../../stores/toast";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import Badges from "./Badges.svelte";
    import WithRole from "./WithRole.svelte";
    import RoleIcon from "./RoleIcon.svelte";
    import ChitBalance from "./ChitBalance.svelte";
    import { disableChit } from "@src/stores/settings";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let userId: string;
    export let alignTo: DOMRect | undefined = undefined;
    export let chatButton = true;
    export let inGlobalContext = false;

    // this is the next thing on the list

    let profile: PublicProfile | undefined = undefined;
    let user: UserSummary | undefined;
    let lastOnline: number | undefined;

    $: diamondStatus = user?.diamondStatus;
    $: me = userId === $createdUser.userId;
    $: isSuspended = user?.suspended ?? false;
    $: modal = $mobileWidth;
    $: [status, online] =
        lastOnline !== undefined && lastOnline !== 0
            ? client.formatLastOnlineDate($_, Date.now(), lastOnline)
            : ["", false];
    $: avatarUrl =
        profile !== undefined
            ? client.buildUserAvatarUrl(
                  import.meta.env.OC_BLOB_URL_PATTERN!,
                  userId,
                  profile.avatarId,
              )
            : "/assets/unknownUserAvatar.svg";
    $: joined =
        profile !== undefined ? `${$_("joined")} ${formatDate(profile.created)}` : undefined;
    $: displayName = client.getDisplayName(
        {
            userId,
            username: profile?.username ?? "",
            displayName: profile?.displayName,
        },
        inGlobalContext ? undefined : $communityMembers,
    );
    $: canBlock = canBlockUser(
        $selectedChat,
        $selectedCommunity,
        $blockedUsers,
        $currentChatBlockedUsers,
        $currentCommunityBlockedUsers,
    );
    $: canUnblock = canUnblockUser(
        $selectedChat,
        $selectedCommunity,
        $blockedUsers,
        $currentChatBlockedUsers,
        $currentCommunityBlockedUsers,
    );

    onMount(async () => {
        try {
            const task1 = client.getPublicProfile(userId);
            const task2 = client.getUser(userId);
            lastOnline = await client.getLastOnlineDate(userId, Date.now());
            user = await task2;
            profile = await task1;
            if (profile === undefined) {
                onClose();
            }
        } catch (e: any) {
            client.logError("Failed to load user profile", e);
            onClose();
        }
    });

    function afterBlock(result: boolean, success: ResourceKey, failure: ResourceKey) {
        if (!result) {
            toastStore.showFailureToast(failure);
        } else {
            toastStore.showSuccessToast(success);
        }
    }

    function blockUser() {
        if ($selectedChat !== undefined) {
            if ($selectedChat.kind === "direct_chat") {
                client.blockUserFromDirectChat(userId).then((success) => {
                    afterBlock(success, i18nKey("blockUserSucceeded"), i18nKey("blockUserFailed"));
                });
                onClose();
                return;
            }
            if ($selectedChat.kind === "group_chat") {
                client.blockUser($selectedChat.id, userId).then((success) => {
                    afterBlock(success, i18nKey("blockUserSucceeded"), i18nKey("blockUserFailed"));
                });
                onClose();
                return;
            }
        }
        if ($selectedCommunity !== undefined) {
            client
                .blockCommunityUser($selectedCommunity.id, userId)
                .then((success) =>
                    afterBlock(success, i18nKey("blockUserSucceeded"), i18nKey("blockUserFailed")),
                );
            onClose();
            return;
        }
    }

    function unblockUser() {
        if ($selectedChat !== undefined) {
            if ($selectedChat.kind === "direct_chat") {
                client.unblockUserFromDirectChat(userId).then((success) => {
                    afterBlock(
                        success,
                        i18nKey("unblockUserSucceeded"),
                        i18nKey("unblockUserFailed"),
                    );
                });
                onClose();
                return;
            }
            if ($selectedChat.kind === "group_chat") {
                client.unblockUser($selectedChat.id, userId).then((success) => {
                    afterBlock(
                        success,
                        i18nKey("unblockUserSucceeded"),
                        i18nKey("unblockUserFailed"),
                    );
                });
                onClose();
                return;
            }
        }
        if ($selectedCommunity !== undefined) {
            client
                .unblockCommunityUser($selectedCommunity.id, userId)
                .then((success) =>
                    afterBlock(
                        success,
                        i18nKey("unblockUserSucceeded"),
                        i18nKey("unblockUserFailed"),
                    ),
                );
            onClose();
            return;
        }
    }

    function canBlockUser(
        chat: ChatSummary | undefined,
        community: CommunitySummary | undefined,
        blockedUsers: Set<string>,
        blockedChatUsers: Set<string>,
        blockedCommunityUsers: Set<string>,
    ) {
        if (me || inGlobalContext) return false;

        if (chat !== undefined) {
            if (chat.kind === "direct_chat") return !blockedUsers.has(userId);
            if (chat.kind === "group_chat")
                return !blockedChatUsers.has(userId) && client.canBlockUsers(chat.id);
        }
        if (community !== undefined) {
            return !blockedCommunityUsers.has(userId) && client.canBlockUsers(community.id);
        }
        return false;
    }

    function canUnblockUser(
        chat: ChatSummary | undefined,
        community: CommunitySummary | undefined,
        blockedUsers: Set<string>,
        blockedChatUsers: Set<string>,
        blockedCommunityUsers: Set<string>,
    ) {
        if (me || inGlobalContext) return false;
        if (chat !== undefined) {
            if (chat.kind === "direct_chat") return blockedUsers.has(userId);
            if (chat.kind === "group_chat")
                return blockedChatUsers.has(userId) && client.canBlockUsers(chat.id);
        }
        if (community !== undefined) {
            return blockedCommunityUsers.has(userId) && client.canBlockUsers(community.id);
        }
        return false;
    }

    function handleOpenDirectChat() {
        dispatch("openDirectChat");
    }

    function showUserProfile() {
        rightPanelHistory.set([{ kind: "user_profile" }]);
        onClose();
    }

    function onClose() {
        dispatch("close");
    }

    function onWindowResize() {
        if (!modal) {
            onClose();
        }
    }

    function formatDate(timestamp: bigint): string {
        const date = new Date(Number(timestamp));
        return date.toLocaleDateString(undefined, {
            month: "short",
            year: "numeric",
        });
    }

    function unsuspendUser() {
        client.unsuspendUser(userId).then((success) => {
            if (success) {
                toastStore.showSuccessToast(i18nKey("unsuspendedUser"));
                onClose();
            } else {
                toastStore.showFailureToast(i18nKey("failedToUnsuspendUser"));
            }
        });
    }

    function suspendUser() {
        client.suspendUser(userId, "").then((success) => {
            if (success) {
                toastStore.showSuccessToast(i18nKey("suspendedUser"));
                onClose();
            } else {
                toastStore.showFailureToast(i18nKey("failedToSuspendUser"));
            }
        });
    }
</script>

<svelte:window on:resize={onWindowResize} />

{#if profile !== undefined}
    <Overlay dismissible {onClose}>
        <ModalContent
            closeIcon
            fill
            square
            compactFooter
            hideFooter={!me && !chatButton && !canBlock && !canUnblock}
            fixedWidth={false}
            large={modal}
            {alignTo}
            on:close>
            <div class="header" slot="header">
                <div class="handle">
                    <div class="display_name">
                        {displayName}
                    </div>
                    <div class="name_and_badges">
                        <div class="username">
                            @{profile.username}
                        </div>
                        <Badges
                            uniquePerson={user?.isUniquePerson}
                            {diamondStatus}
                            streak={client.getStreak(user?.userId)} />
                        {#if user !== undefined && $selectedChat !== undefined && $selectedChat.kind !== "direct_chat"}
                            <WithRole
                                userId={user.userId}
                                chatMembers={$chatMembersMap}
                                communityMembers={$communityMembers}
                                let:chatRole
                                let:communityRole>
                                <RoleIcon level="community" popup role={communityRole} />
                                <RoleIcon
                                    level={$selectedChat.kind === "channel" ? "channel" : "group"}
                                    popup
                                    role={chatRole} />
                            </WithRole>
                        {/if}
                    </div>
                </div>
            </div>
            <div slot="body" class="body" class:modal>
                <div class="avatar">
                    <Avatar url={avatarUrl} {userId} size={AvatarSize.Large} />
                </div>
                {#if user !== undefined && !$disableChit}
                    <ChitBalance
                        size={"small"}
                        {me}
                        balance={user.chitBalance}
                        totalEarned={user.totalChitEarned} />
                {/if}
                {#if profile.bio.length > 0}
                    <p class="bio"><Markdown inline={false} text={profile.bio} /></p>
                {/if}
                <div class="meta">
                    <div class="left" class:suspended={isSuspended}>
                        {#if isSuspended}
                            <Translatable resourceKey={i18nKey("accountSuspended")} />
                        {:else}
                            {#if online}
                                <div class="online"></div>
                            {/if}
                            {status === "" ? "..." : status}
                        {/if}
                    </div>
                    <div class="right">
                        <ClockOutline size={"12px"} color={"var(--txt)"} />
                        {joined}
                    </div>
                </div>
            </div>
            <div slot="footer" class="footer">
                <ButtonGroup align={"fill"}>
                    {#if chatButton && !me}
                        <Button on:click={handleOpenDirectChat} small
                            ><Translatable resourceKey={i18nKey("profile.chat")} /></Button>
                    {/if}
                    {#if me}
                        <Button on:click={showUserProfile} small
                            ><Translatable resourceKey={i18nKey("profile.settings")} /></Button>
                    {/if}
                    {#if canBlock}
                        <Button on:click={blockUser} small
                            ><Translatable resourceKey={i18nKey("profile.block")} /></Button>
                    {/if}
                    {#if canUnblock}
                        <Button on:click={unblockUser} small
                            ><Translatable resourceKey={i18nKey("profile.unblock")} /></Button>
                    {/if}
                </ButtonGroup>
                {#if $platformModerator}
                    <div class="suspend">
                        <ButtonGroup align={"fill"}>
                            {#if isSuspended}
                                <Button on:click={unsuspendUser} small
                                    ><Translatable
                                        resourceKey={i18nKey("unsuspendUser")} /></Button>
                            {:else}
                                <Button on:click={suspendUser} small
                                    ><Translatable resourceKey={i18nKey("suspendUser")} /></Button>
                            {/if}
                        </ButtonGroup>
                    </div>
                {/if}
            </div>
        </ModalContent>
    </Overlay>
{/if}

<style lang="scss">
    .body {
        position: relative;
        display: flex;
        flex-direction: column;
        @include font-size(fs-90);
        word-wrap: break-word;
        width: 320px;
        padding: 0 $sp5 0 $sp5;

        .avatar {
            padding: 0 0 $sp4 0;
            -webkit-box-reflect: below -24px linear-gradient(hsla(0, 0%, 100%, 0), hsla(
                            0,
                            0%,
                            100%,
                            0
                        )
                        45%, hsla(0, 0%, 100%, 0.2));
        }

        .bio {
            max-height: 180px;
            overflow-y: auto;
            @include font(book, normal, fs-80, 20);
            @include nice-scrollbar();
            color: var(--txt-light);
            margin-bottom: $sp3;
            width: 100%;
        }

        &.modal {
            width: 100%;
        }

        .meta {
            @include font(light, normal, fs-60);
            padding: 12px 0;
            margin-top: $sp2;
            border-top: 1px solid var(--bd);
            display: grid;
            grid-template-columns: 1fr 1fr;
            column-gap: $sp3;

            .left,
            .right {
                display: flex;
                align-items: center;
                gap: $sp2;
            }

            .left {
                justify-self: flex-start;
            }

            .right {
                justify-self: flex-end;
            }

            @include mobile() {
                .left,
                .right {
                    @include font(light, normal, fs-90);
                }
            }

            .suspended {
                color: var(--menu-warn);
            }

            .online {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background-color: green;
            }
        }
    }

    .header {
        @include font(bold, normal, fs-100, 21);
        width: 250px;

        .handle {
            overflow-wrap: anywhere;

            .username {
                font-weight: 200;
                color: var(--txt-light);
            }
        }

        .name_and_badges {
            display: inline-flex;
            gap: $sp2;
            align-items: center;
        }
    }

    .suspend {
        margin-top: $sp3;
    }
</style>
