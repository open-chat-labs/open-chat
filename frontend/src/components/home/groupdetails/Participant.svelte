<svelte:options immutable={true} />

<script lang="ts">
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import AccountRemoveOutline from "svelte-material-icons/AccountRemoveOutline.svelte";
    import AccountPlusOutline from "svelte-material-icons/AccountPlusOutline.svelte";
    import MinusCircleOutline from "svelte-material-icons/MinusCircleOutline.svelte";
    import AccountArrowLeftOutline from "svelte-material-icons/AccountArrowLeftOutline.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import { AvatarSize } from "../../../domain/user/user";
    import Avatar from "../../Avatar.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import { _ } from "svelte-i18n";
    import { userAvatarUrl, getUserStatus } from "../../../domain/user/user.utils";
    import { createEventDispatcher } from "svelte";
    import type { BlockedParticipant, FullParticipant } from "../../../domain/chat/chat";
    import { userStore } from "../../../stores/user";
    import { iconSize } from "../../../stores/iconSize";
    import { now } from "../../../stores/time";
    import ViewUserProfile from "../profile/ViewUserProfile.svelte";

    const dispatch = createEventDispatcher();

    export let me: boolean;
    export let participant: FullParticipant | BlockedParticipant;
    export let canDismissAdmin: boolean = false;
    export let canMakeAdmin: boolean = false;
    export let canTransferOwnership: boolean = false;
    export let canRemoveMember: boolean = false;
    export let canBlockUser: boolean = false;
    export let canUnblockUser: boolean = false;

    let hovering = false;
    let viewProfile = false;

    $: showMenu =
        canDismissAdmin ||
        canMakeAdmin ||
        canTransferOwnership ||
        canRemoveMember ||
        canBlockUser ||
        canUnblockUser;

    $: isBlocked = participant.memberKind === "blocked_member";

    function removeUser() {
        dispatch("removeParticipant", participant.userId);
    }

    function transferOwnership() {
        dispatch("transferOwnership", participant);
    }

    function dismissAsAdmin() {
        dispatch("dismissAsAdmin", participant.userId);
    }

    function makeAdmin() {
        dispatch("makeAdmin", participant.userId);
    }

    function participantSelected() {
        if (!me) {
            closeUserProfile();
            dispatch("chatWith", participant.userId);
            dispatch("close");
        }
    }

    function blockUser() {
        dispatch("blockUser", { userId: participant.userId });
    }

    function unblockUser() {
        dispatch("unblockUser", participant);
    }

    function openUserProfile() {
        if (!me) {
            viewProfile = true;
        }
    }

    function closeUserProfile() {
        viewProfile = false;
    }
</script>

{#if viewProfile}
    <ViewUserProfile
        userId={participant.userId}
        on:openDirectChat={participantSelected}
        on:close={closeUserProfile} />
{/if}

<div
    class="participant"
    class:me
    on:click={openUserProfile}
    role="button"
    on:mouseenter={() => (hovering = true)}
    on:mouseleave={() => (hovering = false)}>
    <span class="avatar">
        <Avatar
            statusBorder={hovering && !me ? "var(--participants-hv)" : "var(--participants-bg)"}
            blocked={participant.memberKind === "blocked_member"}
            url={userAvatarUrl(participant)}
            status={getUserStatus($now, $userStore, participant.userId)}
            size={AvatarSize.Small} />
    </span>
    <div class="details">
        <h4 class:blocked={participant.memberKind === "blocked_member"}>
            {me ? $_("you") : participant.username ?? $_("unknownUser")}
        </h4>
        <span class="role">
            {#if participant.role === "owner"}
                ({$_("owner")})
            {:else if participant.role === "admin"}
                ({$_("admin")})
            {/if}
        </span>
    </div>
    {#if showMenu}
        <span class="menu">
            <MenuIcon>
                <span slot="icon">
                    <HoverIcon>
                        <ChevronDown size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                </span>
                <span slot="menu">
                    <Menu>
                        {#if isBlocked}
                            {#if canUnblockUser}
                                <MenuItem on:click={unblockUser}>
                                    <Cancel
                                        size={$iconSize}
                                        color={"var(--icon-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("unblockUser")}</div>
                                </MenuItem>
                            {/if}
                        {:else}
                            {#if canDismissAdmin}
                                <MenuItem on:click={dismissAsAdmin}>
                                    <AccountRemoveOutline
                                        size={$iconSize}
                                        color={"var(--icon-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("dismissAsAdmin")}</div>
                                </MenuItem>
                            {/if}
                            {#if canMakeAdmin}
                                <MenuItem on:click={makeAdmin}>
                                    <AccountPlusOutline
                                        size={$iconSize}
                                        color={"var(--icon-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("makeAdmin")}</div>
                                </MenuItem>
                            {/if}
                            {#if canBlockUser}
                                <MenuItem on:click={blockUser}>
                                    <Cancel
                                        size={$iconSize}
                                        color={"var(--icon-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("blockUser")}</div>
                                </MenuItem>
                            {/if}
                            {#if canRemoveMember}
                                <MenuItem on:click={removeUser}>
                                    <MinusCircleOutline
                                        size={$iconSize}
                                        color={"var(--icon-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("remove")}</div>
                                </MenuItem>
                            {/if}
                            {#if canTransferOwnership}
                                <MenuItem on:click={transferOwnership}>
                                    <AccountArrowLeftOutline
                                        size={$iconSize}
                                        color={"var(--icon-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("transferOwnership")}</div>
                                </MenuItem>
                            {/if}
                        {/if}
                    </Menu>
                </span>
            </MenuIcon>
        </span>
    {/if}
</div>

<style type="text/scss">
    .participant {
        display: flex;
        justify-content: center;
        align-items: center;
        border-bottom: var(--participants-bd);
        background-color: var(--participants-bg);
        color: var(--participants-txt);
        padding: $sp3;
        margin: 0 $sp3 0 $sp3;
        transition: background-color ease-in-out 100ms, border-color ease-in-out 100ms;

        &:not(.me) {
            cursor: pointer;
        }

        &:not(.me):hover {
            background-color: var(--participants-hv);
        }

        @include size-above(xl) {
            margin: 0;
        }
    }
    .avatar {
        flex: 0 0 50px;
        position: relative;
    }

    .role {
        margin: 0 $sp3;
        @include font(light, normal, fs-70);
    }

    .details {
        flex: 1;
        padding: 0 5px;
        display: flex;
        align-items: center;
        @include ellipsis();
    }
</style>
