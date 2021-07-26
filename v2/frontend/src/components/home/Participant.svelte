<script lang="ts">
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import AccountRemoveOutline from "svelte-material-icons/AccountRemoveOutline.svelte";
    import MinusCircleOutline from "svelte-material-icons/MinusCircleOutline.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import { AvatarSize } from "../../domain/user/user";
    import Avatar from "../Avatar.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import type { PartialUserSummary } from "../../domain/user/user";
    import { _ } from "svelte-i18n";
    import { avatarUrl, getUserStatus } from "../../domain/user/user.utils";
    import { createEventDispatcher } from "svelte";
    import type { ActorRefFrom } from "xstate";
    import type { ParticipantsMachine } from "../../fsm/participants.machine";
    const dispatch = createEventDispatcher();

    export let machine: ActorRefFrom<ParticipantsMachine>;
    export let participant: PartialUserSummary;

    function removeUser() {
        machine.send({ type: "REMOVE_PARTICIPANT", data: participant.userId });
    }

    function dismissAsAdmin() {
        machine.send({ type: "DISMISS_AS_ADMIN", data: participant.userId });
    }

    function participantSelected(e: MouseEvent) {
        if (!you) {
            dispatch("chatWith", participant.userId);
            dispatch("close");
        }
    }

    function blockUser() {
        dispatch("blockUser", { userId: participant.userId });
    }

    $: you = $machine.context.user === participant;
</script>

<div class="participant" class:you on:click={participantSelected} role="button">
    <span class="avatar">
        <Avatar
            url={avatarUrl(participant.userId)}
            status={getUserStatus($machine.context.userLookup, participant.userId)}
            size={AvatarSize.Small} />
    </span>
    <h4 class="details">
        {you ? $_("you") : participant.username ?? $_("unknownUser")}
    </h4>
    {#if !you}
        <span class="menu">
            <MenuIcon>
                <span slot="icon">
                    <HoverIcon>
                        <ChevronDown size={"1.2em"} color={"#aaa"} />
                    </HoverIcon>
                </span>
                <span slot="menu">
                    <!-- TODO this menu depends on knowing whether I am an admin and whether the other user is an admin -->
                    <Menu>
                        <MenuItem on:click={removeUser}>
                            <MinusCircleOutline size={"1.2em"} color={"#aaa"} slot="icon" />
                            <div slot="text">{$_("remove")}</div>
                        </MenuItem>
                        <MenuItem on:click={dismissAsAdmin}>
                            <AccountRemoveOutline size={"1.2em"} color={"#aaa"} slot="icon" />
                            <div slot="text">{$_("dismissAsAdmin")}</div>
                        </MenuItem>
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

        &:not(.you) {
            cursor: pointer;
        }

        &:not(.you):hover {
            background-color: var(--participants-hv);
        }
    }
    .avatar {
        flex: 0 0 50px;
    }
    .details {
        flex: 1;
        padding: 0 5px;
    }
</style>
