<svelte:options immutable={true} />

<script lang="ts">
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import AccountRemoveOutline from "svelte-material-icons/AccountRemoveOutline.svelte";
    import AccountPlusOutline from "svelte-material-icons/AccountPlusOutline.svelte";
    import MinusCircleOutline from "svelte-material-icons/MinusCircleOutline.svelte";
    import AccountArrowLeftOutline from "svelte-material-icons/AccountArrowLeftOutline.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import Avatar from "../../Avatar.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext } from "svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { now } from "../../../stores/time";
    import ViewUserProfile from "../profile/ViewUserProfile.svelte";
    import type { OpenChat, BlockedMember, FullMember } from "openchat-client";
    import { AvatarSize } from "openchat-client";
    import FilteredUsername from "../../FilteredUsername.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let me: boolean;
    export let member: FullMember | BlockedMember;
    export let canDismissAdmin: boolean = false;
    export let canMakeAdmin: boolean = false;
    export let canTransferOwnership: boolean = false;
    export let canRemoveMember: boolean = false;
    export let canBlockUser: boolean = false;
    export let canUnblockUser: boolean = false;
    export let searchTerm: string = "";

    // if search term is !== "", split the username into three parts [prefix, match, postfix]

    let hovering = false;
    let viewProfile = false;

    $: showMenu =
        canDismissAdmin ||
        canMakeAdmin ||
        canTransferOwnership ||
        canRemoveMember ||
        canBlockUser ||
        canUnblockUser;

    $: isBlocked = member.memberKind === "blocked_member";

    function removeUser() {
        dispatch("removeMember", member.userId);
    }

    function transferOwnership() {
        dispatch("transferOwnership", member);
    }

    function dismissAsAdmin() {
        dispatch("dismissAsAdmin", member.userId);
    }

    function makeAdmin() {
        dispatch("makeAdmin", member.userId);
    }

    function memberSelected() {
        if (!me) {
            closeUserProfile();
            dispatch("chatWith", member.userId);
            dispatch("close");
        }
    }

    function blockUser() {
        dispatch("blockUser", { userId: member.userId });
    }

    function unblockUser() {
        dispatch("unblockUser", member);
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
        userId={member.userId}
        on:openDirectChat={memberSelected}
        on:close={closeUserProfile} />
{/if}

<div
    class="member"
    class:me
    on:click={openUserProfile}
    role="button"
    on:mouseenter={() => (hovering = true)}
    on:mouseleave={() => (hovering = false)}>
    <span class="avatar">
        <Avatar
            statusBorder={hovering && !me ? "var(--members-hv)" : "transparent"}
            blocked={member.memberKind === "blocked_member"}
            userId={member.userId}
            url={client.userAvatarUrl(member)}
            size={AvatarSize.Default} />
    </span>
    <div class="details">
        <h4 class:diamond={member.diamond} class:blocked={member.memberKind === "blocked_member"}>
            <FilteredUsername {searchTerm} username={member.username} {me} />
        </h4>
        <span class="role">
            {#if member.role === "owner"}
                ({$_("owner")})
            {:else if member.role === "admin"}
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
                                        color={"var(--icon-inverted-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("unblockUser")}</div>
                                </MenuItem>
                            {/if}
                        {:else}
                            {#if canDismissAdmin}
                                <MenuItem on:click={dismissAsAdmin}>
                                    <AccountRemoveOutline
                                        size={$iconSize}
                                        color={"var(--icon-inverted-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("dismissAsAdmin")}</div>
                                </MenuItem>
                            {/if}
                            {#if canMakeAdmin}
                                <MenuItem on:click={makeAdmin}>
                                    <AccountPlusOutline
                                        size={$iconSize}
                                        color={"var(--icon-inverted-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("makeAdmin")}</div>
                                </MenuItem>
                            {/if}
                            {#if canBlockUser}
                                <MenuItem on:click={blockUser}>
                                    <Cancel
                                        size={$iconSize}
                                        color={"var(--icon-inverted-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("blockUser")}</div>
                                </MenuItem>
                            {/if}
                            {#if canRemoveMember}
                                <MenuItem on:click={removeUser}>
                                    <MinusCircleOutline
                                        size={$iconSize}
                                        color={"var(--icon-inverted-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("remove")}</div>
                                </MenuItem>
                            {/if}
                            {#if canTransferOwnership}
                                <MenuItem on:click={transferOwnership}>
                                    <AccountArrowLeftOutline
                                        size={$iconSize}
                                        color={"var(--icon-inverted-txt)"}
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
    .member {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: $sp4;
        transition: background-color ease-in-out 100ms, border-color ease-in-out 100ms;
        gap: 12px;

        &:not(.me) {
            cursor: pointer;
        }

        &:not(.me):hover {
            background-color: var(--members-hv);
        }

        @include mobile() {
            padding: $sp3 $sp4;
        }
    }
    .avatar {
        flex: 0 0 50px;
        position: relative;
    }

    .details {
        flex: 1;
        display: flex;
        align-items: center;
        @include ellipsis();
        @include font(medium, normal, fs-100);
    }

    .diamond {
        @include diamond();
    }

    .role {
        margin: 0 $sp3;
        @include font(light, normal, fs-70);
    }
</style>
