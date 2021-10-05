<svelte:options immutable={true} />

<script lang="ts">
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import AccountRemoveOutline from "svelte-material-icons/AccountRemoveOutline.svelte";
    import AccountPlusOutline from "svelte-material-icons/AccountPlusOutline.svelte";
    import MinusCircleOutline from "svelte-material-icons/MinusCircleOutline.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import AccountLock from "svelte-material-icons/AccountLock.svelte";
    import { AvatarSize } from "../../../domain/user/user";
    import Avatar from "../../Avatar.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import { _ } from "svelte-i18n";
    import { avatarUrl, getUserStatus } from "../../../domain/user/user.utils";
    import { createEventDispatcher } from "svelte";
    import type { FullParticipant, ParticipantRole } from "../../../domain/chat/chat";
    import { userStore } from "../../../stores/user";
    const dispatch = createEventDispatcher();

    export let me: boolean;
    export let participant: FullParticipant;
    export let myRole: ParticipantRole;

    function removeUser() {
        dispatch("removeParticipant", participant.userId);
    }

    function dismissAsAdmin() {
        dispatch("dismissAsAdmin", participant.userId);
    }

    function makeAdmin() {
        dispatch("makeAdmin", participant.userId);
    }

    function participantSelected(_e: MouseEvent) {
        if (!me) {
            dispatch("chatWith", participant.userId);
            dispatch("close");
        }
    }

    function blockUser() {
        dispatch("blockUser", { userId: participant.userId });
    }
</script>

<div class="participant" class:me on:click={participantSelected} role="button">
    <span class="avatar">
        <Avatar
            url={avatarUrl(participant)}
            status={getUserStatus($userStore, participant.userId)}
            size={AvatarSize.Small} />

        {#if participant.role === "admin"}
            <div class="admin">
                <AccountLock size={"1.2em"} color={"#fff"} />
            </div>
        {/if}
    </span>
    <h4 class="details">
        {me ? $_("you") : participant.username ?? $_("unknownUser")}
    </h4>
    {#if !me}
        <span class="menu">
            <MenuIcon>
                <span slot="icon">
                    <HoverIcon>
                        <ChevronDown size={"1.2em"} color={"#aaa"} />
                    </HoverIcon>
                </span>
                <span slot="menu">
                    <Menu>
                        {#if myRole === "admin"}
                            <MenuItem on:click={removeUser}>
                                <MinusCircleOutline size={"1.2em"} color={"#aaa"} slot="icon" />
                                <div slot="text">{$_("remove")}</div>
                            </MenuItem>
                            {#if participant.role === "admin"}
                                <MenuItem on:click={dismissAsAdmin}>
                                    <AccountRemoveOutline
                                        size={"1.2em"}
                                        color={"#aaa"}
                                        slot="icon" />
                                    <div slot="text">{$_("dismissAsAdmin")}</div>
                                </MenuItem>
                            {/if}
                            {#if participant.role === "standard"}
                                <MenuItem on:click={makeAdmin}>
                                    <AccountPlusOutline size={"1.2em"} color={"#aaa"} slot="icon" />
                                    <div slot="text">{$_("makeAdmin")}</div>
                                </MenuItem>
                            {/if}
                        {/if}
                        <!-- TODO need to know if the participant is blocked or not -->
                        <MenuItem on:click={blockUser}>
                            <Cancel size={"1.2em"} color={"#aaa"} slot="icon" />
                            <div slot="text">{$_("blockUser")}</div>
                        </MenuItem>
                    </Menu>
                </span>
            </MenuIcon>
        </span>
    {/if}
</div>

<style type="text/scss">
    .participant {
        display: flex;
        margin-left: $sp3;
        margin-right: $sp3;
        justify-content: center;
        align-items: center;
        border: 1px solid var(--participants-bd);
        background-color: var(--participants-bg);
        color: var(--participants-txt);
        padding: $sp3;
        margin-bottom: $sp3;
        transition: background-color ease-in-out 100ms, border-color ease-in-out 100ms;

        &:not(.me) {
            cursor: pointer;
        }

        &:not(.me):hover {
            background-color: var(--participants-hv);
        }
    }
    .avatar {
        flex: 0 0 50px;
        position: relative;
    }

    .admin {
        position: absolute;
        bottom: -3px;
        right: 16px;
    }

    .details {
        flex: 1;
        padding: 0 5px;
        @include ellipsis();
    }
</style>
